/**
 * lib/crypto/asymmetric.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * RSA-OAEP Key Wrapping — Tier 2 Asymmetric Mode
 *
 * Security constraints:
 *   §9  RSA-OAEP key wrapping via SubtleCrypto; private key never leaves browser
 *   §1  AES key is 32 bytes (256-bit) — same as Tier 1 engine
 *
 * All operations are client-side only. Zero server contact here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { toBase64, fromBase64 } from './encoding';

// ── Algorithm descriptors ──────────────────────────────────────────────────────

const RSA_OAEP_KEYGEN: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), // 65537
  hash: { name: 'SHA-256' },
};

const RSA_OAEP_IMPORT: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: { name: 'SHA-256' },
};

const RSA_OAEP_ALG: RsaOaepParams = { name: 'RSA-OAEP' };

const AES_GCM_256: AesKeyAlgorithm = { name: 'AES-GCM', length: 256 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ensures a Uint8Array is backed by a plain ArrayBuffer (required by SubtleCrypto) */
function ensureBuffer(u: Uint8Array): ArrayBuffer {
  if (u.buffer instanceof ArrayBuffer && u.byteOffset === 0 && u.byteLength === u.buffer.byteLength) {
    return u.buffer;
  }
  return u.slice().buffer;
}

// ── Key Generation ────────────────────────────────────────────────────────────

/**
 * Generates a fresh RSA-2048-OAEP keypair.
 *   - publicKey:  extractable (for SPKI export / sharing)
 *   - privateKey: extractable (needed for IndexedDB round-trip)
 */
export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    RSA_OAEP_KEYGEN,
    true, // extractable — needed for IndexedDB structured clone and SPKI export
    ['wrapKey', 'unwrapKey']
  );
}

// ── Export / Import ───────────────────────────────────────────────────────────

/**
 * Exports an RSA public key to a base64-encoded SPKI string.
 */
export async function exportPublicKeyBase64(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return toBase64(new Uint8Array(spki));
}

/**
 * Exports an RSA private key to a base64-encoded PKCS8 string.
 */
export async function exportPrivateKeyBase64(privateKey: CryptoKey): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  return toBase64(new Uint8Array(pkcs8));
}

/**
 * Imports a base64 SPKI public key for use in wrapKey operations.
 */
export async function importRSAPublicKey(base64: string): Promise<CryptoKey> {
  const spki = fromBase64(base64);
  return crypto.subtle.importKey(
    'spki',
    ensureBuffer(spki),
    RSA_OAEP_IMPORT,
    true,
    ['wrapKey']
  );
}

/**
 * Imports a base64 PKCS8 private key for use in unwrapKey operations.
 */
export async function importRSAPrivateKey(base64: string): Promise<CryptoKey> {
  const pkcs8 = fromBase64(base64);
  return crypto.subtle.importKey(
    'pkcs8',
    ensureBuffer(pkcs8),
    RSA_OAEP_IMPORT,
    true,
    ['unwrapKey']
  );
}

// ── Fingerprint ───────────────────────────────────────────────────────────────

/**
 * Returns the first 8 bytes of SHA-256(SPKI) as 16 lowercase hex chars.
 * Example: "a3f8b2c14e7d9012"
 */
export async function getKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  const digest = await crypto.subtle.digest('SHA-256', spki);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Wrap / Unwrap ─────────────────────────────────────────────────────────────

/**
 * Wraps a raw 32-byte AES-256 key with the recipient's RSA-2048 public key.
 *
 * Flow: rawAESKey → importKey('raw') → wrapKey('raw', rsaPublicKey) → base64
 *
 * The resulting base64 string is stored in `adata[4]` on the server.
 *
 * @param rawAESKey     32 raw bytes of the AES-256 key (from cipher.ts)
 * @param rsaPublicKey  Recipient's imported CryptoKey (wrapKey usage)
 * @returns             Base64-encoded RSA-OAEP-wrapped AES key (~344 chars)
 */
export async function wrapAESKey(
  rawAESKey: Uint8Array,
  rsaPublicKey: CryptoKey
): Promise<string> {
  // Import the raw key as extractable AES-GCM so wrapKey can read it
  const aesKey = await crypto.subtle.importKey(
    'raw',
    ensureBuffer(rawAESKey),
    AES_GCM_256,
    true, // extractable — required for wrapKey to work
    ['encrypt', 'decrypt']
  );

  const wrappedBuffer = await crypto.subtle.wrapKey(
    'raw',        // format of the key being wrapped
    aesKey,       // the AES-256 key to wrap
    rsaPublicKey, // wrapping key (RSA-OAEP public)
    RSA_OAEP_ALG  // wrapping algorithm
  );

  return toBase64(new Uint8Array(wrappedBuffer));
}

/**
 * Unwraps an RSA-OAEP-wrapped AES key using the recipient's RSA private key.
 *
 * @param wrappedKeyBase64  The base64 value from `adata[4]`
 * @param rsaPrivateKey     Recipient's CryptoKey (unwrapKey usage)
 * @returns                 Raw 32-byte AES-256 key as Uint8Array
 * @throws                  If the private key doesn't match
 */
export async function unwrapAESKey(
  wrappedKeyBase64: string,
  rsaPrivateKey: CryptoKey
): Promise<Uint8Array> {
  const wrappedBytes = fromBase64(wrappedKeyBase64);

  const aesKey = await crypto.subtle.unwrapKey(
    'raw',              // format of the wrapped key
    ensureBuffer(wrappedBytes), // the wrapped key bytes
    rsaPrivateKey,      // unwrapping key (RSA-OAEP private)
    RSA_OAEP_ALG,       // unwrapping algorithm
    AES_GCM_256,        // resulting key algorithm
    true,               // extractable (so we can export raw bytes)
    ['encrypt', 'decrypt'] as KeyUsage[]
  );

  const raw = await crypto.subtle.exportKey('raw', aesKey);
  return new Uint8Array(raw);
}
