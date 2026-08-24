/**
 * lib/crypto/encoding.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure binary encoding and hashing utilities — zero DOM / browser dependencies.
 * Safe for execution in Web Workers, Node.js runtime, and Vitest unit tests.
 *
 * Exports:
 *   fnv1a64(data)   → 16 lowercase hex chars (generates deterministic paste ID)
 *   toBase58(bytes) → string (encodes raw 32-byte key for URL #fragment)
 *   fromBase58(str) → Uint8Array (decodes raw key from URL #fragment)
 *   toBase64(bytes) → string (encodes ciphertext, IV, and salt for JSON transport)
 *   fromBase64(str) → Uint8Array (decodes base64 strings to byte buffers)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import basex from 'base-x';

// ── FNV-1a HASH ALGORITHM ──────────────────────────────────────────────

// FNV-1a 64-bit offset basis (split into high/low 32-bit unsigned words to avoid BigInt dependencies)
const FNV_OFFSET_HI = 0xcbf29ce4 >>> 0;
const FNV_OFFSET_LO = 0x84222325 >>> 0;

// FNV-1a 64-bit prime (0x00000100_000001b3)
const FNV_PRIME_HI = 0x00000100 >>> 0;
const FNV_PRIME_LO = 0x000001b3 >>> 0;

/**
 * Computes FNV-1a 64-bit non-cryptographic hash of a Uint8Array.
 * Returns 16 lowercase zero-padded hex characters.
 * Used as the deterministic paste identifier: `fnv1a64(ciphertext_bytes)`.
 */
export function fnv1a64(data: Uint8Array): string {
  let hi = FNV_OFFSET_HI;
  let lo = FNV_OFFSET_LO;

  for (let i = 0; i < data.length; i++) {
    lo = (lo ^ data[i]) >>> 0;

    const newLo = Math.imul(lo, FNV_PRIME_LO) >>> 0;
    const newHi = (
      (Math.imul(hi, FNV_PRIME_LO) >>> 0) +
      (Math.imul(lo, FNV_PRIME_HI) >>> 0)
    ) >>> 0;

    lo = newLo;
    hi = newHi;
  }

  const hiHex = hi.toString(16).padStart(8, '0');
  const loHex = lo.toString(16).padStart(8, '0');
  return hiHex + loHex;
}

// ── BASE58 ENCODING ───────────────────────────────────────────────────

// Bitcoin Base58 alphabet (omits 0, O, I, l to prevent visual confusion in share URLs)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = (typeof basex === 'function' ? basex : (basex as unknown as { default: typeof basex }).default)(BASE58_ALPHABET);

/**
 * Encodes a Uint8Array as a Base58 string.
 * Used to encode the 32-byte AES key for the URL fragment (#key).
 */
export function toBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

/**
 * Decodes a Base58 string back to a Uint8Array.
 * Throws an error if any character is outside the Base58 alphabet.
 */
export function fromBase58(str: string): Uint8Array {
  for (let i = 0; i < str.length; i++) {
    if (!BASE58_ALPHABET.includes(str[i])) {
      throw new Error(`Invalid Base58 character: '${str[i]}'`);
    }
  }
  return bs58.decode(str);
}

// ── BASE64 ENCODING ───────────────────────────────────────────────────

/**
 * Encodes a Uint8Array as a standard base64 string with padding.
 * Automatically chooses Buffer in Node.js or btoa in browser runtimes.
 */
export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a standard base64 string back to a Uint8Array.
 * Automatically chooses Buffer in Node.js or atob in browser runtimes.
 */
export function fromBase64(str: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(str, 'base64'));
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
