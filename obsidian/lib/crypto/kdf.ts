/**
 * lib/crypto/kdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PBKDF2-SHA256 Key Derivation Function & Secure Context Guard.
 * Security constraint §2: PBKDF2-SHA256 ≥ 100,000 iterations.
 *
 * Zero DOM dependencies — pure SubtleCrypto API execution.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── SECURE CONTEXT GUARD & PBKDF2 DERIVATION ────────────────────────────

/**
 * Asserts that the Web Crypto API (crypto.subtle) is available in the current browser runtime.
 * Throws a clear human-readable error if accessed over insecure HTTP contexts.
 */
export function assertSubtleCrypto(): void {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      '[crypto] Web Crypto API (crypto.subtle) is unavailable. ' +
      'Please access the application via http://localhost:3000 or http://127.0.0.1:3000.'
    );
  }
}

/**
 * Derives an AES-256-GCM CryptoKey from password and salt bytes using PBKDF2-SHA256.
 *
 * @param password   - Raw password bytes
 * @param salt       - Random 8-byte salt
 * @param iterations - PBKDF2 iteration count (must be ≥ 100,000 per security constraint §2)
 * @returns          - Extractable AES-256-GCM CryptoKey ready for encrypt/decrypt
 */
export async function deriveKey(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  // Assert browser Secure Context availability (crypto.subtle requirement)
  assertSubtleCrypto();

  // Assert security constraint §2 (≥ 100k iterations)
  if (iterations < 100_000) {
    throw new Error(
      `[kdf] iterations must be ≥ 100,000 (got ${iterations}). ` +
      'This is a non-negotiable security constraint.'
    );
  }

  const passwordBuf = new Uint8Array(password) as unknown as Uint8Array<ArrayBuffer>;
  const saltBuf = new Uint8Array(salt) as unknown as Uint8Array<ArrayBuffer>;

  // Import raw password bytes into PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuf,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive 256-bit AES-GCM key
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
    true,
    ['encrypt', 'decrypt']
  );
}
