/**
 * lib/crypto/cipher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tier 1 AES-256-GCM encryption engine.
 *
 * This is the PRIMARY export Member C imports. It is the only file in lib/crypto/
 * that C is allowed to touch. It internally uses kdf.ts, compress.ts, encoding.ts
 * but C never imports those directly.
 *
 * Security constraints enforced here:
 *   §1  AES-256-GCM via SubtleCrypto
 *   §2  PBKDF2-SHA256, ≥ 100k iterations (called inline here; Worker wraps this)
 *   §4  v2 wire format: adata[0] = [iv, salt, iter, 256, 128, 'aes', 'gcm', compression]
 *
 * Zero DOM deps — pure SubtleCrypto + Web Streams (Node.js ≥ 18).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { deriveKey } from './kdf';
import { tryCompress, decompress } from './compress';
import { toBase64, fromBase64 } from './encoding';
import type { AdataSchema } from '@/lib/api/schemas';

// ── Constants ─────────────────────────────────────────────────────────────────

const ITERATIONS = 100_000;
const KEY_SIZE   = 256; // bits
const TAG_SIZE   = 128; // bits (GCM auth tag)
const IV_BYTES   = 16;  // 128-bit IV
const SALT_BYTES = 8;   // 64-bit salt

// ── Types ─────────────────────────────────────────────────────────────────────

export type EncryptResult = {
  /** Base64 AES-GCM ciphertext (to POST as `ct`) */
  ciphertext: string;
  /** Full v2 adata array (to POST as `adata`) */
  adata: AdataSchema;
  /** Non-extractable CryptoKey (for in-memory use) */
  key: CryptoKey;
  /** Raw 32-byte key — goes in URL #fragment as base58 */
  rawKey: Uint8Array;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Casts a Uint8Array to the ArrayBuffer-backed variant required by SubtleCrypto.
 * TS 5.x tightened Uint8Array<ArrayBufferLike> → Uint8Array<ArrayBuffer>.
 * .slice() always returns a new Uint8Array backed by a plain ArrayBuffer.
 */
function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u.buffer instanceof ArrayBuffer
    ? (u as unknown as Uint8Array<ArrayBuffer>)
    : (new Uint8Array(u) as unknown as Uint8Array<ArrayBuffer>);
}

/** Generates cryptographically random bytes */
function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

/**
 * Exports a CryptoKey to its raw bytes.
 * Only works when the key was created with extractable=true.
 */
async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/**
 * Imports a raw 32-byte Uint8Array as an AES-256-GCM CryptoKey.
 * Used in decrypt() and for encrypting comments under the shared key.
 */
async function importRawKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt']
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    buf(raw),
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}

// ── encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Flow:
 *   1. Generate random 16-byte IV and 8-byte salt
 *   2. Derive 32-byte AES key from PBKDF2-SHA256(password|random, salt, 100k)
 *   3. Compress plaintext (deflate-raw; falls back to 'none' if larger)
 *   4. AES-256-GCM encrypt with additionalData = JSON.stringify(adata[0])
 *   5. Return ciphertext (base64), adata, key (CryptoKey), rawKey (Uint8Array)
 *
 * @param plaintext - UTF-8 text to encrypt
 * @param formatter - adata[1] content type (default 'plaintext')
 * @param options   - Optional: burnAfterReading, openDiscussion
 * @returns         EncryptResult
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
  const { burnAfterReading = true, openDiscussion = false, customKey } = options;

  // 1. Generate IV and salt
  const iv   = randomBytes(IV_BYTES);
  const salt = randomBytes(SALT_BYTES);

  // 2. Derive AES key (or import provided shared key for comments)
  let key: CryptoKey;
  let rawKey: Uint8Array;

  if (customKey) {
    rawKey = customKey;
    key = await importRawKey(customKey);
  } else {
    key = await deriveKey(
      randomBytes(32), // random 32-byte password (symmetric direct mode)
      salt,
      ITERATIONS
    );
    rawKey = await exportRawKey(key);
  }

  // 3. Compress plaintext
  const encoder   = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);
  const { data: compressed, method } = await tryCompress(plainBytes);

  // 4. Build adata[0] spec — this becomes the AAD for AES-GCM
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

  // additionalData = the spec array serialized — authenticated but not encrypted
  const aad = new TextEncoder().encode(JSON.stringify(spec));

  // 5. AES-256-GCM encrypt
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

// ── decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypts an AES-256-GCM ciphertext using the provided key.
 *
 * Accepts either:
 *   - A CryptoKey (for in-memory round-trips)
 *   - A raw 32-byte Uint8Array (decoded from the URL #fragment)
 *
 * @param ciphertext - Base64 AES-GCM ciphertext (the `ct` field from the server)
 * @param adata      - Full v2 adata array (the `adata` field from the server)
 * @param keyOrRaw   - CryptoKey or raw 32-byte Uint8Array
 * @returns          Decrypted plaintext string
 * @throws           If decryption fails (wrong key, tampered adata, etc.)
 */
export async function decrypt(
  ciphertext: string,
  adata: AdataSchema,
  keyOrRaw: CryptoKey | Uint8Array
): Promise<string> {
  const spec = adata[0];
  const iv         = fromBase64(spec[0]);
  const compression = spec[7]; // 'zlib' | 'none'

  // Resolve key
  const key: CryptoKey =
    keyOrRaw instanceof CryptoKey
      ? keyOrRaw
      : await importRawKey(keyOrRaw);

  // AAD must match exactly what was used during encryption
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

  // Decompress if needed
  let plainBytes: Uint8Array = new Uint8Array(decryptedBuffer);
  if (compression === 'zlib') {
    plainBytes = await decompress(buf(plainBytes));
  }

  return new TextDecoder().decode(plainBytes);
}

// ── decryptWithPassword ───────────────────────────────────────────────────────

/**
 * Derives the AES key from PBKDF2 and decrypts.
 * Used when the raw key is in the URL fragment as base58.
 *
 * @param ciphertext - Base64 AES-GCM ciphertext
 * @param adata      - Full v2 adata array
 * @param rawKey     - 32-byte key decoded from URL #fragment via fromBase58()
 */
export async function decryptWithRawKey(
  ciphertext: string,
  adata: AdataSchema,
  rawKey: Uint8Array
): Promise<string> {
  return decrypt(ciphertext, adata, rawKey);
}

// Re-export toBase58/fromBase58 so Member C can encode/decode the URL fragment
// without importing from encoding.ts directly.
export { toBase58, fromBase58 } from './encoding';
