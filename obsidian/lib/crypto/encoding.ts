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
const BASE58_MAP: Record<string, number> = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET[i]] = i;
}

/**
 * Encodes a Uint8Array as a Base58 string.
 * Used to encode the raw 32-byte AES key for the URL #fragment.
 */
export function toBase58(bytes: Uint8Array): string {
  // Count leading zero bytes
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }

  // Convert bytes to a big integer (working array of base-256 digits)
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  // Build the output string (most-significant digit first)
  let result = BASE58_ALPHABET[1].repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

/**
 * Decodes a Base58 string back to a Uint8Array.
 * Throws if any character is not in the Base58 alphabet.
 */
export function fromBase58(str: string): Uint8Array {
  // Count leading '1' chars (represent zero bytes)
  let leadingZeros = 0;
  while (leadingZeros < str.length && str[leadingZeros] === '1') {
    leadingZeros++;
  }

  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const value = BASE58_MAP[str[i]];
    if (value === undefined) {
      throw new Error(`Invalid Base58 character: '${str[i]}'`);
    }
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Reverse (we built LSB-first) and prepend zero bytes for leading '1's
  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[leadingZeros + i] = bytes[bytes.length - 1 - i];
  }
  return result;
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
