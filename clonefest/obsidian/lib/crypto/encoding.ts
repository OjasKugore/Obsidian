/**
 * lib/crypto/encoding.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure encoding utilities — zero DOM / browser deps.
 * Safe to run in Web Workers and Node.js (vitest).
 *
 * Exports:
 *   fnv1a64(data)          → 16 lowercase hex chars   (paste ID)
 *   toBase58(bytes)        → string                   (URL key encoding)
 *   fromBase58(str)        → Uint8Array
 *   toBase64(bytes)        → string                   (ciphertext / IV / salt)
 *   fromBase64(str)        → Uint8Array
 * ─────────────────────────────────────────────────────────────────────────────
 */

import basex from 'base-x';

// ── FNV-1a 64-bit ─────────────────────────────────────────────────────────────
// Reference: http://www.isthe.com/chongo/tech/comp/fnv/
// We avoid BigInt for max compatibility; represent the 64-bit state as two
// 32-bit unsigned halves [hi, lo].

const FNV_OFFSET_HI = 0xcbf29ce4 >>> 0;
const FNV_OFFSET_LO = 0x84222325 >>> 0;
// FNV prime = 0x00000100_000001b3
const FNV_PRIME_HI = 0x00000100 >>> 0;
const FNV_PRIME_LO = 0x000001b3 >>> 0;

/**
 * FNV-1a 64-bit hash of a Uint8Array.
 * Returns 16 lowercase hex characters (zero-padded).
 *
 * Used as the paste ID: `fnv1a64(ciphertext_bytes)`.
 */
export function fnv1a64(data: Uint8Array): string {
  let hi = FNV_OFFSET_HI;
  let lo = FNV_OFFSET_LO;

  for (let i = 0; i < data.length; i++) {
    // XOR with byte (affects only low word)
    lo = (lo ^ data[i]) >>> 0;

    // Multiply [hi:lo] by the 64-bit FNV prime.
    // Only the low 64 bits are kept (modular arithmetic).
    //
    // (hi:lo) * prime =
    //   hi_new = (hi * prime_lo + lo * prime_hi) mod 2^32   [carry ignored]
    //   lo_new = (lo * prime_lo)                 mod 2^32
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
  return hiHex + loHex; // 16 lowercase hex chars
}

// ── Base58 ────────────────────────────────────────────────────────────────────
// Bitcoin alphabet (no 0, O, I, l — avoids visual confusion in URLs).

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = (typeof basex === 'function' ? basex : (basex as unknown as { default: typeof basex }).default)(BASE58_ALPHABET);

/**
 * Encodes a Uint8Array as a Base58 string.
 * Used to encode the raw 32-byte AES key for the URL #fragment.
 */
export function toBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

/**
 * Decodes a Base58 string back to a Uint8Array.
 * Throws if any character is not in the Base58 alphabet.
 */
export function fromBase58(str: string): Uint8Array {
  // Validate characters
  for (let i = 0; i < str.length; i++) {
    if (!BASE58_ALPHABET.includes(str[i])) {
      throw new Error(`Invalid Base58 character: '${str[i]}'`);
    }
  }
  return bs58.decode(str);
}


// ── Base64 ────────────────────────────────────────────────────────────────────
// Standard base64 (with padding). Used for IV, salt, and ciphertext in adata.

/**
 * Encodes a Uint8Array as a standard base64 string.
 */
export function toBase64(bytes: Uint8Array): string {
  // Use Buffer in Node.js, btoa in browser/worker
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
