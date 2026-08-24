/**
 * lib/crypto/cipher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tier 1 AES-256-GCM Encryption & Decryption Engine.
 *
 * Core security constraints:
 *   §1  AES-256-GCM via SubtleCrypto
 *   §2  PBKDF2-SHA256, ≥ 100k iterations (derived inline via kdf.ts)
 *   §4  v2 wire format: adata[0] = [iv, salt, iter, 256, 128, 'aes', 'gcm', compression]
 *
 * Zero DOM dependencies — pure SubtleCrypto + Web Streams API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { deriveKey, assertSubtleCrypto } from './kdf';
import { tryCompress, decompress } from './compress';
import { toBase64, fromBase64 } from './encoding';
import type { AdataSchema } from '@/lib/api/schemas';

// ── CIPHER PARAMETERS & ENGINE CONSTANTS ────────────────────────────

const ITERATIONS = 100_000;
const KEY_SIZE   = 256; // bits
const TAG_SIZE   = 128; // bits (GCM authentication tag length)
const IV_BYTES   = 16;  // 128-bit initialization vector
const SALT_BYTES = 8;   // 64-bit random salt

export type EncryptResult = {
  /** Base64 AES-GCM ciphertext (POSTed to server as `ct`) */
  ciphertext: string;
  /** Full v2 adata array (POSTed to server as `adata`) */
  adata: AdataSchema;
  /** Non-extractable CryptoKey (held in browser memory) */
  key: CryptoKey;
  /** Raw 32-byte key — encoded in URL fragment (#key) */
  rawKey: Uint8Array;
};

// ── HELPER UTILITIES ──────────────────────────────────────────────────

/** Casts a Uint8Array to the ArrayBuffer-backed type required by SubtleCrypto */
function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u.buffer instanceof ArrayBuffer
    ? (u as unknown as Uint8Array<ArrayBuffer>)
    : (new Uint8Array(u) as unknown as Uint8Array<ArrayBuffer>);
}

/** Generates cryptographically secure random bytes using Web Crypto API */
function randomBytes(n: number): Uint8Array {
  assertSubtleCrypto();
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

/** Exports extractable CryptoKey to raw Uint8Array byte buffer */
async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  assertSubtleCrypto();
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/** Imports a raw 32-byte Uint8Array buffer into an AES-256-GCM CryptoKey */
async function importRawKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt']
): Promise<CryptoKey> {
  assertSubtleCrypto();
  return crypto.subtle.importKey(
    'raw',
    buf(raw),
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}

// ── AES-256-GCM ENCRYPTION ────────────────────────────────────────────

/**
 * Encrypts plaintext string using AES-256-GCM authenticated encryption.
 *
 * Flow:
 *   1. Generate random 16-byte IV and 8-byte salt
 *   2. Derive 32-byte AES key from PBKDF2-SHA256(random_password, salt, 100k)
 *   3. Compress plaintext using deflate-raw stream compression
 *   4. AES-256-GCM encrypt with authenticated additionalData = JSON.stringify(adata[0])
 *   5. Return base64 ciphertext, adata schema, CryptoKey, and raw byte key
 */
export async function encrypt(
  plaintext: string,
  formatter: 'plaintext' | 'markdown' | 'syntaxhighlighting' = 'plaintext',
  options: {
    burnAfterReading?: boolean;
    openDiscussion?: boolean;
    customKey?: Uint8Array;
  } = {}
): Promise<EncryptResult> {
  assertSubtleCrypto();
  const { burnAfterReading = true, openDiscussion = false, customKey } = options;

  // 1. Generate random IV and salt
  const iv   = randomBytes(IV_BYTES);
  const salt = randomBytes(SALT_BYTES);

  // 2. Derive AES key or import custom key
  let key: CryptoKey;
  let rawKey: Uint8Array;

  if (customKey) {
    rawKey = customKey;
    key = await importRawKey(customKey);
  } else {
    key = await deriveKey(
      randomBytes(32),
      salt,
      ITERATIONS
    );
    rawKey = await exportRawKey(key);
  }

  // 3. Compress plaintext bytes
  const encoder   = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);
  const { data: compressed, method } = await tryCompress(plainBytes);

  // 4. Construct authenticated adata[0] specification header
  const spec: AdataSchema[0] = [
    toBase64(iv),
    toBase64(salt),
    ITERATIONS,
    KEY_SIZE,
    TAG_SIZE,
    'aes',
    'gcm',
    method,
  ];

  const adata: AdataSchema = [
    spec,
    formatter,
    openDiscussion ? 1 : 0,
    burnAfterReading ? 1 : 0,
  ];

  const aad = new TextEncoder().encode(JSON.stringify(spec));

  // 5. Execute AES-256-GCM encryption
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad), tagLength: TAG_SIZE },
    key,
    buf(compressed)
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    adata,
    key,
    rawKey,
  };
}

// ── AES-256-GCM DECRYPTION ────────────────────────────────────────────

/**
 * Decrypts AES-256-GCM ciphertext using either a CryptoKey or raw 32-byte key buffer.
 *
 * Flow:
 *   1. Unpack IV, salt, and compression algorithm from adata[0]
 *   2. Reconstruct authenticated additionalData (AAD)
 *   3. Execute SubtleCrypto.decrypt using AES-256-GCM
 *   4. Decompress decrypted bytes if compression was used
 *   5. Decode UTF-8 plaintext string
 */
export async function decrypt(
  ciphertext: string,
  adata: AdataSchema,
  keyOrRaw: CryptoKey | Uint8Array
): Promise<string> {
  assertSubtleCrypto();
  const spec = adata[0];
  const iv         = fromBase64(spec[0]);
  const compression = spec[7];

  const key: CryptoKey =
    keyOrRaw instanceof CryptoKey
      ? keyOrRaw
      : await importRawKey(keyOrRaw);

  const aad = new TextEncoder().encode(JSON.stringify(spec));

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad), tagLength: TAG_SIZE },
      key,
      buf(fromBase64(ciphertext))
    );
  } catch {
    throw new Error(
      'Decryption failed — wrong key, tampered ciphertext, or corrupted adata.'
    );
  }

  let plainBytes: Uint8Array = new Uint8Array(decryptedBuffer);
  if (compression === 'zlib') {
    plainBytes = await decompress(buf(plainBytes));
  }

  return new TextDecoder().decode(plainBytes);
}

/** Decrypts paste ciphertext using raw key Uint8Array derived from URL hash fragment */
export async function decryptWithRawKey(
  ciphertext: string,
  adata: AdataSchema,
  rawKey: Uint8Array
): Promise<string> {
  return decrypt(ciphertext, adata, rawKey);
}

// Re-export Base58 helpers for URL fragment key handling
export { toBase58, fromBase58 } from './encoding';
