/**
 * lib/crypto/kdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PBKDF2-SHA256 key derivation function.
 *
 * IMPORTANT: This module is designed to be called ONLY from the Web Worker
 * (workers/crypto.worker.ts). Running PBKDF2 at 100k iterations on the main
 * thread would block the UI for ~500ms.
 *
 * Zero DOM deps — pure SubtleCrypto (available in browser, Workers, Node ≥ 15).
 *
 * Security constraint §2: PBKDF2-SHA256 ≥ 100,000 iterations.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Derives an AES-256-GCM CryptoKey from a password and salt using PBKDF2-SHA256.
 *
 * @param password   - Raw password bytes (from URL fragment or empty for random key)
 * @param salt       - Random 8-byte salt (stored in adata[0][1] as base64)
 * @param iterations - PBKDF2 iteration count (≥ 100,000 per security constraint §2)
 * @returns          - Non-extractable AES-256-GCM CryptoKey ready for encrypt/decrypt
 */
export async function deriveKey(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  if (iterations < 100_000) {
    throw new Error(
      `[kdf] iterations must be ≥ 100,000 (got ${iterations}). ` +
        'This is a non-negotiable security constraint.'
    );
  }

  // SubtleCrypto requires ArrayBuffer-backed views (TS 5.x strict typing).
  // Buffer.from() always returns a Uint8Array<ArrayBuffer>.
  const passwordBuf = new Uint8Array(password) as unknown as Uint8Array<ArrayBuffer>;
  const saltBuf     = new Uint8Array(salt)     as unknown as Uint8Array<ArrayBuffer>;

  // Import the raw password bytes as a PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuf,
    { name: 'PBKDF2' },
    false, // not extractable
    ['deriveKey']
  );

  // Derive a 256-bit AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuf,
      iterations,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,  // extractable = true so cipher.ts can export rawKey for URL fragment
    ['encrypt', 'decrypt']
  );
}
