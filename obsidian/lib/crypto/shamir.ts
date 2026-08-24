/**
 * lib/crypto/shamir.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shamir's Secret Sharing (SSS) over Galois Field GF(2^8) with optional
 * RSA-OAEP Public Key Shard Wrapping (Targeted Multi-Party Custody).
 *
 * Pure TypeScript, zero external dependencies, runs in Node.js and Browser.
 *
 * Mathematical properties:
 *   - Field: GF(2^8) with irreducible polynomial P(x) = x^8 + x^4 + x^3 + x + 1 (0x11b)
 *   - Generator: g = 3
 *   - Addition / Subtraction: XOR
 *   - Multiplication / Division: Exp/Log tables over GF(2^8)
 *   - Reconstruction: Lagrange basis polynomials evaluated at x = 0
 *   - RSA Wrapping: RSA-2048-OAEP per-shard encapsulation to eliminate Dealer backdoors.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { wrapAESKey, unwrapAESKey, importRSAPublicKey } from './asymmetric';

// ── GF(256) Field Arithmetic Tables ──────────────────────────────────────────

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
    if (hi) x ^= 0x1b; // 0x11b mod 0x100
    x ^= EXP_TABLE[i];
  }
  LOG_TABLE[0] = 0; // log(0) undefined, sentinel
})();

/** Multiply two elements in GF(256) */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

/** Divide two elements in GF(256): a / b */
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('GF(256) division by zero');
  if (a === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] - LOG_TABLE[b] + 255];
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ShardInfo {
  index: number;         // 1-based index (x-coordinate)
  threshold: number;     // minimum required shards (k)
  total?: number;        // optional total shards (n)
  data?: Uint8Array;     // shard evaluations for each byte (present if unwrapped)
  rawString: string;     // serialized shard string
  isRSAWrapped?: boolean;// true if encapsulated in RSA-OAEP
  wrappedBase64?: string;// RSA ciphertext base64 if wrapped
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// URL-safe Base64 helpers for shard strings
function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBase64(b64url: string): string {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return b64;
}

// ── Core API ─────────────────────────────────────────────────────────────────

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
  // Polynomial coefficients for each byte:
  // For byte b: coeffs[b] = [a0, a1, ..., a_{k-1}] where a0 = secret[b]
  const randomCoeffs = new Uint8Array(byteLength * (threshold - 1));
  crypto.getRandomValues(randomCoeffs);

  const resultShards: string[] = [];

  // Generate share for each x = 1 .. shares
  for (let shareIdx = 1; shareIdx <= shares; shareIdx++) {
    const x = shareIdx;
    const shareBytes = new Uint8Array(byteLength);

    for (let b = 0; b < byteLength; b++) {
      // f_b(0) = secret[b]
      let y = secret[b];

      // evaluate polynomial at x: y = a0 ^ (a1 * x) ^ (a2 * x^2) ^ ...
      let xPower = x;
      for (let degree = 1; degree < threshold; degree++) {
        const coeff = randomCoeffs[b * (threshold - 1) + (degree - 1)];
        y ^= gfMul(coeff, xPower);
        xPower = gfMul(xPower, x);
      }

      shareBytes[b] = y;
    }

    // Format: shard-${threshold}-${shareIdx}-${shares}-${bytesToHex(shareBytes)}
    const shardString = `shard-${threshold}-${shareIdx}-${shares}-${bytesToHex(shareBytes)}`;
    resultShards.push(shardString);
  }

  return resultShards;
}

/**
 * Splits a raw secret and wraps individual shares with recipient RSA public keys.
 * This completely eliminates Dealer backdoors because the creator cannot decrypt
 * the RSA-wrapped shares once memory is cleared.
 */
export async function splitAndWrapKey(
  secret: Uint8Array,
  shares: number,
  threshold: number,
  recipientPublicKeys?: Array<string | CryptoKey | null | undefined>
): Promise<string[]> {
  const rawShards = splitKey(secret, shares, threshold);

  if (!recipientPublicKeys || recipientPublicKeys.length === 0) {
    return rawShards;
  }

  const wrappedResults: string[] = [];
  for (let i = 0; i < rawShards.length; i++) {
    const pubKey = recipientPublicKeys[i];
    if (pubKey) {
      const wrapped = await wrapShardWithRSA(rawShards[i], pubKey);
      wrappedResults.push(wrapped);
    } else {
      wrappedResults.push(rawShards[i]);
    }
  }

  return wrappedResults;
}

/**
 * Encapsulates an individual shard string using a recipient's RSA-OAEP public key.
 */
export async function wrapShardWithRSA(
  rawShardString: string,
  rsaPublicKey: CryptoKey | string
): Promise<string> {
  const parsed = parseShard(rawShardString);
  if (!parsed || !parsed.data) {
    throw new Error('Invalid raw shard string for RSA wrapping');
  }

  const pubKey =
    typeof rsaPublicKey === 'string'
      ? await importRSAPublicKey(rsaPublicKey)
      : rsaPublicKey;

  // Wrap the 32-byte raw shard data with RSA-OAEP
  const wrappedBase64 = await wrapAESKey(parsed.data, pubKey);
  const safeUrlPayload = base64ToBase64Url(wrappedBase64);

  return `shard-${parsed.threshold}-${parsed.index}-${parsed.total || 0}-rsa-${safeUrlPayload}`;
}

/**
 * Decapsulates an RSA-wrapped shard string using the recipient's RSA private key.
 */
export async function unwrapShardWithRSA(
  wrappedShardString: string,
  rsaPrivateKey: CryptoKey
): Promise<string> {
  const parsed = parseShard(wrappedShardString);
  if (!parsed || !parsed.isRSAWrapped || !parsed.wrappedBase64) {
    throw new Error('Shard is not an RSA-wrapped shard string');
  }

  const standardBase64 = base64UrlToBase64(parsed.wrappedBase64);
  const rawShardBytes = await unwrapAESKey(standardBase64, rsaPrivateKey);

  return `shard-${parsed.threshold}-${parsed.index}-${parsed.total || 0}-${bytesToHex(rawShardBytes)}`;
}

/**
 * Reconstructs the original secret from an array of shard strings.
 * Shards must be unwrapped prior to reconstruction.
 *
 * @param shardStrings - Array of serialized shard strings (must contain at least `threshold` unique shards)
 * @returns Reconstructed secret as Uint8Array
 */
export function combineShards(shardStrings: string[]): Uint8Array {
  if (!shardStrings || shardStrings.length === 0) {
    throw new Error('No shards provided for reconstruction');
  }

  // Parse and deduplicate by index
  const shardMap = new Map<number, ShardInfo>();

  for (const s of shardStrings) {
    const parsed = parseShard(s);
    if (parsed) {
      if (parsed.isRSAWrapped) {
        throw new Error(
          `Shard #${parsed.index} is RSA-wrapped. Unlock it with the recipient private key before combining.`
        );
      }
      shardMap.set(parsed.index, parsed);
    }
  }

  const validShards = Array.from(shardMap.values());
  if (validShards.length === 0) {
    throw new Error('No valid shards found');
  }

  const threshold = validShards[0].threshold;
  const byteLength = validShards[0].data?.length || 0;

  if (validShards.length < threshold) {
    throw new Error(
      `Insufficient shards: provided ${validShards.length}, required threshold is ${threshold}`
    );
  }

  // Verify all shards have matching threshold and length
  for (const shard of validShards) {
    if (!shard.data) {
      throw new Error(`Shard #${shard.index} has no decrypted data payload`);
    }
    if (shard.threshold !== threshold) {
      throw new Error('Mismatched threshold across shards');
    }
    if (shard.data.length !== byteLength) {
      throw new Error('Mismatched data length across shards');
    }
  }

  // Take the first `threshold` unique shards
  const subset = validShards.slice(0, threshold);
  const reconstructed = new Uint8Array(byteLength);

  // Compute Lagrange basis polynomials at x = 0 for each shard j:
  // L_j(0) = \prod_{m \ne j} (x_m / (x_j ^ x_m))
  const lagrangeWeights = new Uint8Array(threshold);

  for (let j = 0; j < threshold; j++) {
    const xj = subset[j].index;
    let weight = 1;

    for (let m = 0; m < threshold; m++) {
      if (m === j) continue;
      const xm = subset[m].index;
      const denominator = xj ^ xm; // in GF(256), xj - xm is xj ^ xm
      const factor = gfDiv(xm, denominator);
      weight = gfMul(weight, factor);
    }

    lagrangeWeights[j] = weight;
  }

  // Reconstruct each byte: secret[b] = \sum_{j=0}^{k-1} subset[j].data[b] * L_j(0)
  for (let b = 0; b < byteLength; b++) {
    let secretByte = 0;
    for (let j = 0; j < threshold; j++) {
      secretByte ^= gfMul(subset[j].data![b], lagrangeWeights[j]);
    }
    reconstructed[b] = secretByte;
  }

  return reconstructed;
}

/**
 * Parses a shard string into structured metadata and data.
 * Accepts formats:
 *   - `shard-<threshold>-<index>-<total>-<hex>`
 *   - `shard-<threshold>-<index>-<total>-rsa-<base64url>`
 *   - `shard-<threshold>-<index>-<hex>`
 *   - `shard:<threshold>:<index>:<hex>`
 *   - `s-<threshold>-<index>-<hex>`
 */
export function parseShard(input: string): ShardInfo | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  let clean = trimmed;
  if (clean.includes('#')) {
    clean = clean.split('#')[1];
  }

  // Pattern: shard-k-i-n-rsa-... or shard-k-i-n-hex
  const parts = clean.split(/[-:]/);
  if (parts.length >= 4 && (parts[0].toLowerCase() === 'shard' || parts[0].toLowerCase() === 's')) {
    const threshold = parseInt(parts[1], 10);
    const index = parseInt(parts[2], 10);
    let total: number | undefined;

    // Check for RSA-wrapped format: shard-k-idx-n-rsa-<payload> or shard-k-idx-rsa-<payload>
    const rsaIdx = parts.findIndex((p) => p.toLowerCase() === 'rsa');
    if (rsaIdx !== -1 && rsaIdx + 1 < parts.length) {
      if (rsaIdx === 3 && /^\d+$/.test(parts[2])) {
        // shard-k-idx-rsa-payload
        total = undefined;
      } else if (rsaIdx === 4 && /^\d+$/.test(parts[3])) {
        // shard-k-idx-total-rsa-payload
        total = parseInt(parts[3], 10);
      }
      const wrappedPayload = parts.slice(rsaIdx + 1).join('-');
      return {
        index,
        threshold,
        total,
        isRSAWrapped: true,
        wrappedBase64: wrappedPayload,
        rawString: clean,
      };
    }

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
          isRSAWrapped: false,
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
