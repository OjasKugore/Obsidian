/**
 * tests/unit/cipher.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for lib/crypto/cipher.ts (Tier 1 AES-256-GCM engine)
 *
 * Covers:
 *   - encrypt → decrypt round-trip (CryptoKey)
 *   - encrypt → decrypt round-trip (rawKey / URL fragment path)
 *   - Wrong key fails with a clear error
 *   - Tampered adata fails (GCM auth tag)
 *   - Tampered ciphertext fails
 *   - All formatter types round-trip
 *   - adata wire format shape is correct (v2 spec)
 *   - rawKey is 32 bytes
 *   - ciphertext is base64
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, decryptWithRawKey } from '../../lib/crypto/cipher';
import type { AdataSchema } from '../../lib/api/schemas';

const PLAINTEXT = 'Hello, Obsidian! 🔐 This is a secret message.';

// ── Round-trip tests ──────────────────────────────────────────────────────────

describe('encrypt / decrypt round-trip', () => {
  it('round-trips plaintext using CryptoKey', async () => {
    const result = await encrypt(PLAINTEXT);
    const decrypted = await decrypt(result.ciphertext, result.adata, result.key);
    expect(decrypted).toBe(PLAINTEXT);
  });

  it('round-trips plaintext using rawKey (URL fragment path)', async () => {
    const result = await encrypt(PLAINTEXT);
    const decrypted = await decryptWithRawKey(
      result.ciphertext,
      result.adata,
      result.rawKey
    );
    expect(decrypted).toBe(PLAINTEXT);
  });

  it('round-trips empty string', async () => {
    const result = await encrypt('');
    const decrypted = await decrypt(result.ciphertext, result.adata, result.key);
    expect(decrypted).toBe('');
  });

  it('round-trips a large payload (100 KB)', async () => {
    const large = 'x'.repeat(100_000);
    const result = await encrypt(large);
    const decrypted = await decrypt(result.ciphertext, result.adata, result.key);
    expect(decrypted).toBe(large);
  });

  it('round-trips unicode / emoji content', async () => {
    const unicode = '日本語テスト 🔑🔐🛡️ العربية Ελληνικά';
    const result = await encrypt(unicode);
    const decrypted = await decrypt(result.ciphertext, result.adata, result.key);
    expect(decrypted).toBe(unicode);
  });

  it('round-trips markdown formatter', async () => {
    const result = await encrypt('# Hello\n**bold**', 'markdown');
    expect(result.adata[1]).toBe('markdown');
    const decrypted = await decrypt(result.ciphertext, result.adata, result.key);
    expect(decrypted).toBe('# Hello\n**bold**');
  });

  it('two encryptions of same plaintext produce different ciphertexts (random IV)', async () => {
    const r1 = await encrypt(PLAINTEXT);
    const r2 = await encrypt(PLAINTEXT);
    expect(r1.ciphertext).not.toBe(r2.ciphertext);
  });
});

// ── Wrong key / tamper tests ──────────────────────────────────────────────────

describe('security: wrong key / tampered data', () => {
  it('decryption with wrong rawKey throws', async () => {
    const result = await encrypt(PLAINTEXT);
    const wrongKey = new Uint8Array(32);
    crypto.getRandomValues(wrongKey);
    await expect(
      decryptWithRawKey(result.ciphertext, result.adata, wrongKey)
    ).rejects.toThrow('Decryption failed');
  });

  it('decryption with tampered ciphertext throws (GCM auth tag failure)', async () => {
    const result = await encrypt(PLAINTEXT);
    // Flip a byte in the base64 ciphertext by modifying raw bytes
    const ctBytes = Uint8Array.from(atob(result.ciphertext), (c) =>
      c.charCodeAt(0)
    );
    ctBytes[0] ^= 0xff; // flip first byte
    const tamperedCt = btoa(String.fromCharCode(...ctBytes));

    await expect(
      decrypt(tamperedCt, result.adata, result.key)
    ).rejects.toThrow('Decryption failed');
  });

  it('decryption with tampered adata (AAD mismatch) throws', async () => {
    const result = await encrypt(PLAINTEXT);

    // Tamper adata[0][2] (iterations field) — this changes the AAD
    const tamperedAdata: AdataSchema = [
      [
        result.adata[0][0], // iv
        result.adata[0][1], // salt
        200_000,            // ← tampered iterations (was 100_000)
        result.adata[0][3], // keySize
        result.adata[0][4], // tagSize
        result.adata[0][5], // algo
        result.adata[0][6], // mode
        result.adata[0][7], // compression
      ],
      result.adata[1],
      result.adata[2],
      result.adata[3],
    ];

    await expect(
      decrypt(result.ciphertext, tamperedAdata, result.key)
    ).rejects.toThrow('Decryption failed');
  });

  it('decryption with tampered IV throws', async () => {
    const result = await encrypt(PLAINTEXT);
    const ivBytes = Uint8Array.from(atob(result.adata[0][0]), (c) =>
      c.charCodeAt(0)
    );
    ivBytes[0] ^= 0xff;
    const tamperedIV = btoa(String.fromCharCode(...ivBytes));

    const tamperedAdata: AdataSchema = [
      [
        tamperedIV,           // ← tampered IV
        result.adata[0][1],
        result.adata[0][2],
        result.adata[0][3],
        result.adata[0][4],
        result.adata[0][5],
        result.adata[0][6],
        result.adata[0][7],
      ],
      result.adata[1],
      result.adata[2],
      result.adata[3],
    ];

    await expect(
      decrypt(result.ciphertext, tamperedAdata, result.key)
    ).rejects.toThrow('Decryption failed');
  });
});

// ── EncryptResult shape validation ────────────────────────────────────────────

describe('EncryptResult shape (v2 wire format)', () => {
  it('rawKey is exactly 32 bytes', async () => {
    const result = await encrypt(PLAINTEXT);
    expect(result.rawKey).toBeInstanceOf(Uint8Array);
    expect(result.rawKey.byteLength).toBe(32);
  });

  it('ciphertext is a non-empty base64 string', async () => {
    const result = await encrypt(PLAINTEXT);
    expect(typeof result.ciphertext).toBe('string');
    expect(result.ciphertext.length).toBeGreaterThan(0);
    expect(result.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('adata[0] has the correct v2 wire format', async () => {
    const result = await encrypt(PLAINTEXT);
    const spec = result.adata[0];
    expect(spec).toHaveLength(8);
    expect(typeof spec[0]).toBe('string'); // iv (base64)
    expect(typeof spec[1]).toBe('string'); // salt (base64)
    expect(spec[2]).toBe(100_000);         // iterations
    expect(spec[3]).toBe(256);             // keySize
    expect(spec[4]).toBe(128);             // tagSize
    expect(spec[5]).toBe('aes');
    expect(spec[6]).toBe('gcm');
    expect(['zlib', 'none']).toContain(spec[7]); // compression
  });

  it('adata[1] defaults to "plaintext"', async () => {
    const result = await encrypt(PLAINTEXT);
    expect(result.adata[1]).toBe('plaintext');
  });

  it('adata[3] = 1 (burn after reading by default)', async () => {
    const result = await encrypt(PLAINTEXT);
    expect(result.adata[3]).toBe(1);
  });

  it('adata[2] = 0 (open discussion off by default)', async () => {
    const result = await encrypt(PLAINTEXT);
    expect(result.adata[2]).toBe(0);
  });

  it('respects burnAfterReading=false option', async () => {
    const result = await encrypt(PLAINTEXT, 'plaintext', {
      burnAfterReading: false,
    });
    expect(result.adata[3]).toBe(0);
  });

  it('respects openDiscussion=true option', async () => {
    const result = await encrypt(PLAINTEXT, 'plaintext', {
      openDiscussion: true,
    });
    expect(result.adata[2]).toBe(1);
  });

  it('key is a CryptoKey with encrypt+decrypt usages', async () => {
    const result = await encrypt(PLAINTEXT);
    expect(result.key).toBeInstanceOf(CryptoKey);
    expect(result.key.usages).toContain('encrypt');
    expect(result.key.usages).toContain('decrypt');
    expect(result.key.algorithm.name).toBe('AES-GCM');
  });
});
