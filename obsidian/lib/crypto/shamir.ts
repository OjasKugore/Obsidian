/**
 * lib/crypto/shamir.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shamir's Secret Sharing (SSS) over Galois Field GF(2^8).
 * Pure TypeScript, zero external dependencies, runs in Node.js and Browser.
 *
 * Mathematical properties:
 *   - Field: GF(2^8) with irreducible polynomial P(x) = x^8 + x^4 + x^3 + x + 1 (0x11b)
 *   - Generator: g = 3
 *   - Addition / Subtraction: XOR
 *   - Multiplication / Division: Exp/Log tables over GF(2^8)
 *   - Reconstruction: Lagrange basis polynomials evaluated at x = 0
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { assertSubtleCrypto } from './kdf';

// ── GF(256) GALOIS FIELD ARITHMETIC ───────────────────────────────────

const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGF256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;

    // Multiply by generator g = 3: (x * 2) ^ x
    const hi = x & 0x80;
    x = (x << 1) & 0xff;
    if (hi) x ^= 0x1b;
    x ^= EXP_TABLE[i];
  }
  LOG_TABLE[0] = 0;
})();

/** Multiplies two elements in GF(256) */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

/** Divides two elements in GF(256): a / b */
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('GF(256) division by zero');
  if (a === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] - LOG_TABLE[b] + 255];
}

// ── HELPER DATA CONVERTERS ────────────────────────────────────────────

export interface ShardInfo {
  index: number;     // 1-based index (x-coordinate)
  threshold: number; // minimum required shards (k)
  total?: number;    // optional total shards (n)
  data: Uint8Array;  // shard evaluations for each byte
  rawString: string; // serialized shard string
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error('Invalid hex character in shard data');
    bytes[i] = byte;
  }
  return bytes;
}

// ── SHAMIR SECRET SHARING API ──────────────────────────────────────────

/**
 * Splits a raw secret (e.g. 32-byte AES key) into `shares` shards such that
 * any `threshold` shards can reconstruct the secret.
 *
 * @param secret - Uint8Array secret (typically 32 bytes for AES-256)
 * @param shares - Total number of shares to generate (n, 2 <= shares <= 255)
 * @param threshold - Minimum number of shares required to reconstruct (k, 2 <= threshold <= shares)
 * @returns Array of serialized shard strings
 */
export function splitKey(
  secret: Uint8Array,
  shares: number,
  threshold: number
): string[] {
  assertSubtleCrypto();
  if (secret.length === 0) {
    throw new Error('Secret cannot be empty');
  }
  if (shares < 2 || shares > 255) {
    throw new Error('Total shares (n) must be between 2 and 255');
  }
  if (threshold < 2 || threshold > shares) {
    throw new Error('Threshold (k) must be between 2 and total shares (n)');
  }

  const byteLength = secret.length;
  const randomCoeffs = new Uint8Array(byteLength * (threshold - 1));
  crypto.getRandomValues(randomCoeffs);

  const resultShards: string[] = [];

  for (let shareIdx = 1; shareIdx <= shares; shareIdx++) {
    const x = shareIdx;
    const shareBytes = new Uint8Array(byteLength);

    for (let b = 0; b < byteLength; b++) {
      let y = secret[b];

      let xPower = x;
      for (let degree = 1; degree < threshold; degree++) {
        const coeff = randomCoeffs[b * (threshold - 1) + (degree - 1)];
        y ^= gfMul(coeff, xPower);
        xPower = gfMul(xPower, x);
      }

      shareBytes[b] = y;
    }

    const shardString = `shard-${threshold}-${shareIdx}-${shares}-${bytesToHex(shareBytes)}`;
    resultShards.push(shardString);
  }

  return resultShards;
}

/**
 * Reconstructs the original secret from an array of shard strings using Lagrange interpolation at x=0.
 *
 * @param shardStrings - Array of serialized shard strings (must contain at least `threshold` unique shards)
 * @returns Reconstructed secret as Uint8Array
 */
export function combineShards(shardStrings: string[]): Uint8Array {
  if (!shardStrings || shardStrings.length === 0) {
    throw new Error('No shards provided for reconstruction');
  }

  const shardMap = new Map<number, ShardInfo>();

  for (const s of shardStrings) {
    const parsed = parseShard(s);
    if (parsed) {
      shardMap.set(parsed.index, parsed);
    }
  }

  const validShards = Array.from(shardMap.values());
  if (validShards.length === 0) {
    throw new Error('No valid shards found');
  }

  const threshold = validShards[0].threshold;
  const byteLength = validShards[0].data.length;

  if (validShards.length < threshold) {
    throw new Error(
      `Insufficient shards: provided ${validShards.length}, required threshold is ${threshold}`
    );
  }

  for (const shard of validShards) {
    if (shard.threshold !== threshold) {
      throw new Error('Mismatched threshold across shards');
    }
    if (shard.data.length !== byteLength) {
      throw new Error('Mismatched data length across shards');
    }
  }

  const subset = validShards.slice(0, threshold);
  const reconstructed = new Uint8Array(byteLength);

  const lagrangeWeights = new Uint8Array(threshold);

  for (let j = 0; j < threshold; j++) {
    const xj = subset[j].index;
    let weight = 1;

    for (let m = 0; m < threshold; m++) {
      if (m === j) continue;
      const xm = subset[m].index;
      const denominator = xj ^ xm;
      const factor = gfDiv(xm, denominator);
      weight = gfMul(weight, factor);
    }

    lagrangeWeights[j] = weight;
  }

  for (let b = 0; b < byteLength; b++) {
    let secretByte = 0;
    for (let j = 0; j < threshold; j++) {
      secretByte ^= gfMul(subset[j].data[b], lagrangeWeights[j]);
    }
    reconstructed[b] = secretByte;
  }

  return reconstructed;
}

// ── SHARD PARSING & LINK EXTRACTION ────────────────────────────────────

/**
 * Parses a shard string into structured metadata and data.
 */
export function parseShard(input: string): ShardInfo | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  let clean = trimmed;
  if (clean.includes('#')) {
    clean = clean.split('#')[1];
  }

  const parts = clean.split(/[-:]/);
  if (parts.length >= 4 && (parts[0].toLowerCase() === 'shard' || parts[0].toLowerCase() === 's')) {
    const threshold = parseInt(parts[1], 10);
    const index = parseInt(parts[2], 10);
    let total: number | undefined;
    let hexData: string;

    if (parts.length >= 5 && /^\d+$/.test(parts[3])) {
      total = parseInt(parts[3], 10);
      hexData = parts.slice(4).join('');
    } else {
      hexData = parts.slice(3).join('');
    }

    if (
      !Number.isNaN(threshold) &&
      !Number.isNaN(index) &&
      threshold >= 2 &&
      index >= 1 &&
      hexData.length > 0
    ) {
      try {
        const data = hexToBytes(hexData);
        return {
          index,
          threshold,
          total,
          data,
          rawString: clean,
        };
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Extracts a shard string from a full URL, URL fragment, or pasted text.
 */
export function extractShardFromUrl(input: string): string | null {
  if (!input) return null;
  const parsed = parseShard(input);
  return parsed ? parsed.rawString : null;
}
