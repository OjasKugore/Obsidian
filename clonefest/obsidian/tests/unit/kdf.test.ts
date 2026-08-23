/**
 * tests/unit/kdf.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for lib/crypto/kdf.ts
 *
 * Covers:
 *   - Same password + salt + iterations → same derived key bytes
 *   - Different salt → different derived key
 *   - Different password → different derived key
 *   - Iterations < 100k → throws
 *   - Output is a usable AES-256-GCM CryptoKey
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { deriveKey } from '../../lib/crypto/kdf';
import { toBase64 } from '../../lib/crypto/encoding';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(new Uint8Array(raw));
}

const PASSWORD = new TextEncoder().encode('test-password-for-vitest');
const SALT     = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const ITERS    = 100_000;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deriveKey', () => {
  it('returns a CryptoKey with correct algorithm and usages', async () => {
    const key = await deriveKey(PASSWORD, SALT, ITERS);
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('same password + salt + iterations → same derived key (deterministic)', async () => {
    const key1 = await deriveKey(PASSWORD, SALT, ITERS);
    const key2 = await deriveKey(PASSWORD, SALT, ITERS);
    expect(await exportKey(key1)).toBe(await exportKey(key2));
  });

  it('different salt → different derived key', async () => {
    const salt2 = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
    const key1 = await deriveKey(PASSWORD, SALT, ITERS);
    const key2 = await deriveKey(PASSWORD, salt2, ITERS);
    expect(await exportKey(key1)).not.toBe(await exportKey(key2));
  });

  it('different password → different derived key', async () => {
    const pass2 = new TextEncoder().encode('different-password');
    const key1 = await deriveKey(PASSWORD, SALT, ITERS);
    const key2 = await deriveKey(pass2, SALT, ITERS);
    expect(await exportKey(key1)).not.toBe(await exportKey(key2));
  });

  it('different iteration count → different derived key', async () => {
    const key1 = await deriveKey(PASSWORD, SALT, 100_000);
    const key2 = await deriveKey(PASSWORD, SALT, 200_000);
    expect(await exportKey(key1)).not.toBe(await exportKey(key2));
  });

  it('throws if iterations < 100,000 (security constraint §2)', async () => {
    await expect(deriveKey(PASSWORD, SALT, 99_999)).rejects.toThrow(
      /iterations must be ≥ 100,000/
    );
    await expect(deriveKey(PASSWORD, SALT, 1)).rejects.toThrow(
      /iterations must be ≥ 100,000/
    );
  });

  it('allows iterations > 100,000', async () => {
    const key = await deriveKey(PASSWORD, SALT, 150_000);
    expect(key).toBeDefined();
  });

  it('works with empty password bytes (random key mode)', async () => {
    const emptyPass = new Uint8Array(0);
    const key = await deriveKey(emptyPass, SALT, ITERS);
    expect(key.type).toBe('secret');
  });

  it('works with a 32-byte random password (typical symmetric mode)', async () => {
    const randomPass = new Uint8Array(32);
    crypto.getRandomValues(randomPass);
    const key = await deriveKey(randomPass, SALT, ITERS);
    expect(key.type).toBe('secret');
  });
});
