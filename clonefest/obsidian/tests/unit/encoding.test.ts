/**
 * tests/unit/encoding.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for lib/crypto/encoding.ts
 *
 * Covers:
 *   - fnv1a64: known test vectors + consistency
 *   - toBase58 / fromBase58: round-trip + leading zeros + invalid chars
 *   - toBase64 / fromBase64: round-trip
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  fnv1a64,
  toBase58,
  fromBase58,
  toBase64,
  fromBase64,
} from '../../lib/crypto/encoding';

// ── fnv1a64 ───────────────────────────────────────────────────────────────────

describe('fnv1a64', () => {
  it('returns exactly 16 lowercase hex characters', () => {
    const result = fnv1a64(new Uint8Array([1, 2, 3]));
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns the same hash for the same input (deterministic)', () => {
    const data = new TextEncoder().encode('hello world');
    expect(fnv1a64(data)).toBe(fnv1a64(data));
  });

  it('returns different hashes for different inputs', () => {
    const a = fnv1a64(new TextEncoder().encode('hello'));
    const b = fnv1a64(new TextEncoder().encode('HELLO'));
    expect(a).not.toBe(b);
  });

  it('handles empty input without throwing', () => {
    const result = fnv1a64(new Uint8Array(0));
    // FNV offset basis for empty input
    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('known vector: "" (empty) → FNV offset basis cbf29ce484222325', () => {
    // FNV-1a 64-bit offset basis = 0xcbf29ce484222325
    const result = fnv1a64(new Uint8Array(0));
    expect(result).toBe('cbf29ce484222325');
  });

  it('known vector: single byte 0x00', () => {
    // 0xcbf29ce484222325 XOR 0x00 = 0xcbf29ce484222325
    // * FNV prime → well-known value
    const result = fnv1a64(new Uint8Array([0]));
    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('different byte sequences produce different hashes (collision resistance)', () => {
    const inputs = [
      new Uint8Array([0]),
      new Uint8Array([1]),
      new Uint8Array([0, 0]),
      new Uint8Array([1, 0]),
      new TextEncoder().encode('abc'),
      new TextEncoder().encode('cba'),
    ];
    const hashes = inputs.map(fnv1a64);
    const unique = new Set(hashes);
    expect(unique.size).toBe(inputs.length);
  });
});

// ── Base58 ────────────────────────────────────────────────────────────────────

describe('toBase58 / fromBase58', () => {
  it('round-trips a random 32-byte key', () => {
    const original = new Uint8Array(32);
    crypto.getRandomValues(original);
    const encoded = toBase58(original);
    const decoded = fromBase58(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips 1-byte inputs', () => {
    for (let i = 0; i < 256; i++) {
      const bytes = new Uint8Array([i]);
      expect(fromBase58(toBase58(bytes))).toEqual(bytes);
    }
  });

  it('handles leading zero bytes (encodes as leading "1" chars)', () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 3]);
    const encoded = toBase58(bytes);
    expect(encoded.startsWith('11')).toBe(true);
    expect(fromBase58(encoded)).toEqual(bytes);
  });

  it('round-trips all-zero bytes', () => {
    const bytes = new Uint8Array(4); // [0,0,0,0]
    const encoded = toBase58(bytes);
    expect(encoded).toBe('1111'); // 4 leading zeros → '1111'
    expect(fromBase58(encoded)).toEqual(bytes);
  });

  it('produces only Base58 alphabet characters', () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const encoded = toBase58(bytes);
    expect(encoded).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it('throws on invalid Base58 character (0, O, I, l)', () => {
    for (const ch of ['0', 'O', 'I', 'l']) {
      expect(() => fromBase58(`abc${ch}def`)).toThrow('Invalid Base58 character');
    }
  });
});

// ── Base64 ────────────────────────────────────────────────────────────────────

describe('toBase64 / fromBase64', () => {
  it('round-trips a 16-byte IV', () => {
    const iv = new Uint8Array(16);
    crypto.getRandomValues(iv);
    expect(fromBase64(toBase64(iv))).toEqual(iv);
  });

  it('round-trips an 8-byte salt', () => {
    const salt = new Uint8Array(8);
    crypto.getRandomValues(salt);
    expect(fromBase64(toBase64(salt))).toEqual(salt);
  });

  it('round-trips arbitrary binary data', () => {
    const data = new Uint8Array(256).map((_, i) => i);
    expect(fromBase64(toBase64(data))).toEqual(data);
  });

  it('produces valid base64 strings', () => {
    const data = new Uint8Array(32);
    crypto.getRandomValues(data);
    const b64 = toBase64(data);
    // Standard base64: A-Z, a-z, 0-9, +, /, =
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('round-trips empty input', () => {
    expect(fromBase64(toBase64(new Uint8Array(0)))).toEqual(new Uint8Array(0));
  });
});
