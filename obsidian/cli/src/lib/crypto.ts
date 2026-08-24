/**
 * cli/src/lib/crypto.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained crypto engine for the Obsidian CLI.
 * Produces wire-format-compatible output with the browser app (same adata schema).
 * Runs on Node.js 18+ (uses globalThis.crypto / SubtleCrypto).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── Constants ─────────────────────────────────────────────────────────────────

const ITERATIONS = 100_000;
const KEY_SIZE   = 256;
const TAG_SIZE   = 128;
const IV_BYTES   = 16;
const SALT_BYTES = 8;

// ── Encoding ──────────────────────────────────────────────────────────────────

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function getBase58() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const basex: any = require('base-x');
  const fn = typeof basex === 'function' ? basex : basex.default;
  return fn(BASE58_ALPHABET);
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

export function toBase58(bytes: Uint8Array): string {
  return getBase58().encode(bytes);
}

export function fromBase58(str: string): Uint8Array {
  for (const c of str) {
    if (!BASE58_ALPHABET.includes(c)) throw new Error(`Invalid Base58 char: '${c}'`);
  }
  return getBase58().decode(str);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u.buffer instanceof ArrayBuffer
    ? (u as unknown as Uint8Array<ArrayBuffer>)
    : (new Uint8Array(u) as unknown as Uint8Array<ArrayBuffer>);
}

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

async function importRawAES(raw: Uint8Array): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw', buf(raw),
    { name: 'AES-GCM', length: 256 },
    true, ['encrypt', 'decrypt']
  );
}

async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', key));
}

// ── Compression (simple gzip via Node zlib) ───────────────────────────────────

async function compress(data: Uint8Array): Promise<{ data: Uint8Array; method: 'zlib' | 'none' }> {
  try {
    const { promisify } = await import('util');
    const { deflateRaw } = await import('zlib');
    const deflate = promisify(deflateRaw);
    const compressed = new Uint8Array(await deflate(data));
    if (compressed.length < data.length) return { data: compressed, method: 'zlib' };
  } catch { /* fall through */ }
  return { data, method: 'none' };
}

async function decompress(data: Uint8Array, method: string): Promise<Uint8Array> {
  if (method !== 'zlib') return data;
  const { promisify } = await import('util');
  const { inflateRaw } = await import('zlib');
  const inflate = promisify(inflateRaw);
  return new Uint8Array(await inflate(data));
}

// ── AES-256-GCM Encrypt ───────────────────────────────────────────────────────

export interface EncryptResult {
  ciphertext: string;
  adata: unknown[];
  rawKey: Uint8Array;
}

export async function aesEncrypt(
  plaintext: string,
  options: {
    burnAfterReading?: boolean;
    openDiscussion?: boolean;
    customKey?: Uint8Array;
  } = {}
): Promise<EncryptResult> {
  const { burnAfterReading = true, openDiscussion = false, customKey } = options;

  const iv   = randomBytes(IV_BYTES);
  const salt = randomBytes(SALT_BYTES);

  // Derive or import key
  let key: CryptoKey;
  let rawKey: Uint8Array;

  if (customKey) {
    rawKey = customKey;
    key = await importRawAES(customKey);
  } else {
    // Generate random AES key directly (no password needed)
    key = await globalThis.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, ['encrypt', 'decrypt']
    );
    rawKey = await exportRawKey(key);
  }

  const encoder   = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);
  const { data: compressed, method } = await compress(plainBytes);

  const spec = [
    toBase64(iv), toBase64(salt),
    ITERATIONS, KEY_SIZE, TAG_SIZE,
    'aes', 'gcm', method,
  ];

  const adata = [
    spec,
    'plaintext',
    openDiscussion ? 1 : 0,
    burnAfterReading ? 1 : 0,
  ];

  const aad = encoder.encode(JSON.stringify(spec));

  const ctBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad), tagLength: TAG_SIZE },
    key,
    buf(compressed)
  );

  return {
    ciphertext: toBase64(new Uint8Array(ctBuf)),
    adata,
    rawKey,
  };
}

// ── AES-256-GCM Decrypt ───────────────────────────────────────────────────────

export async function aesDecrypt(
  ciphertext: string,
  adata: unknown[],
  rawKey: Uint8Array
): Promise<string> {
  const spec = adata[0] as string[];
  const iv          = fromBase64(spec[0]);
  const compression = spec[7];

  const key = await importRawAES(rawKey);
  const aad = new TextEncoder().encode(JSON.stringify(spec));

  let decrypted: ArrayBuffer;
  try {
    decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad), tagLength: TAG_SIZE },
      key,
      buf(fromBase64(ciphertext))
    );
  } catch {
    throw new Error('Decryption failed — wrong key or corrupted data.');
  }

  const plain = await decompress(new Uint8Array(decrypted), compression);
  return new TextDecoder().decode(plain);
}

// ── RSA-OAEP Key Management ───────────────────────────────────────────────────

export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['wrapKey', 'unwrapKey']
  );
}

export async function exportPublicKeyBase64(key: CryptoKey): Promise<string> {
  const spki = await globalThis.crypto.subtle.exportKey('spki', key);
  return Buffer.from(spki).toString('base64');
}

export async function exportPrivateKeyBase64(key: CryptoKey): Promise<string> {
  const pkcs8 = await globalThis.crypto.subtle.exportKey('pkcs8', key);
  return Buffer.from(pkcs8).toString('base64');
}

export async function importRSAPublicKey(base64: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'spki',
    Buffer.from(base64, 'base64'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey']
  );
}

export async function importRSAPrivateKey(base64: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'pkcs8',
    Buffer.from(base64, 'base64'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['unwrapKey']
  );
}

export async function wrapAESKey(rawKey: Uint8Array, publicKey: CryptoKey): Promise<string> {
  const aesKey = await importRawAES(rawKey);
  const wrapped = await globalThis.crypto.subtle.wrapKey('raw', aesKey, publicKey, { name: 'RSA-OAEP' });
  return Buffer.from(wrapped).toString('base64');
}

export async function unwrapAESKey(wrappedBase64: string, privateKey: CryptoKey): Promise<Uint8Array> {
  const wrappedBytes = Buffer.from(wrappedBase64, 'base64');
  const aesKey = await globalThis.crypto.subtle.unwrapKey(
    'raw',
    wrappedBytes,
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', aesKey));
}

export async function getKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const spki = new Uint8Array(await globalThis.crypto.subtle.exportKey('spki', publicKey));
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buf(spki)));
  return Array.from(hash.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
