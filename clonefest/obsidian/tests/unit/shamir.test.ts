/**
 * tests/unit/shamir.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for Shamir's Secret Sharing (lib/crypto/shamir.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  splitKey,
  combineShards,
  parseShard,
  extractShardFromUrl,
} from '@/lib/crypto/shamir';
import { encrypt, decrypt } from '@/lib/crypto/cipher';

describe('Shamir Secret Sharing (SSS)', () => {
  it('should split and reconstruct a 32-byte AES key with 2-of-3 threshold', () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);

    const shards = splitKey(rawKey, 3, 2);
    expect(shards).toHaveLength(3);

    // Any 2 shards should reconstruct the exact key
    const pairs = [
      [shards[0], shards[1]],
      [shards[0], shards[2]],
      [shards[1], shards[2]],
      [shards[2], shards[0]], // Order shouldn't matter
    ];

    for (const pair of pairs) {
      const recovered = combineShards(pair);
      expect(recovered).toEqual(rawKey);
    }
  });

  it('should split and reconstruct with 3-of-5 threshold', () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);

    const shards = splitKey(rawKey, 5, 3);
    expect(shards).toHaveLength(5);

    // Any 3 shards reconstruct
    const triplet1 = [shards[0], shards[2], shards[4]];
    const triplet2 = [shards[1], shards[3], shards[4]];

    expect(combineShards(triplet1)).toEqual(rawKey);
    expect(combineShards(triplet2)).toEqual(rawKey);

    // All 5 shards reconstruct
    expect(combineShards(shards)).toEqual(rawKey);
  });

  it('should fail or throw when fewer than threshold shards are provided', () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);

    const shards = splitKey(rawKey, 3, 2);

    // 1 shard when threshold is 2
    expect(() => combineShards([shards[0]])).toThrowError(/Insufficient shards/);
  });

  it('should handle duplicate shards gracefully (does not satisfy threshold if unique count is below k)', () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);

    const shards = splitKey(rawKey, 3, 2);

    // 2 copies of shard 0
    expect(() => combineShards([shards[0], shards[0]])).toThrowError(/Insufficient shards/);
  });

  it('should parse various shard formats correctly', () => {
    const shardStr = 'shard-3-2-5-0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
    const parsed = parseShard(shardStr);

    expect(parsed).not.toBeNull();
    expect(parsed?.threshold).toBe(3);
    expect(parsed?.index).toBe(2);
    expect(parsed?.total).toBe(5);
    expect(parsed?.data).toHaveLength(32);
  });

  it('should extract shard from full URL and hash fragments', () => {
    const shardToken = 'shard-2-1-3-0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
    const fullUrl = `https://obsidian.app/a1b2c3d4e5f67890#${shardToken}`;

    const extracted = extractShardFromUrl(fullUrl);
    expect(extracted).toBe(shardToken);
  });

  it('should integrate seamlessly with AES-256-GCM cipher encryption and decryption', async () => {
    const secretMessage = 'Top secret quorum data to be split among board members';

    // 1. Standard Tier 1 AES-256-GCM encrypt
    const encResult = await encrypt(secretMessage, 'plaintext');
    const { ciphertext, adata, rawKey } = encResult;

    // 2. Split AES key into 3 shards (2-of-3)
    const shards = splitKey(rawKey, 3, 2);

    // 3. Reconstruct key using shards 1 & 3
    const recoveredKey = combineShards([shards[0], shards[2]]);
    expect(recoveredKey).toEqual(rawKey);

    // 4. Decrypt ciphertext with recovered key
    const decrypted = await decrypt(ciphertext, adata, recoveredKey);
    expect(decrypted).toBe(secretMessage);
  });

  it('should validate invalid parameters', () => {
    const dummy = new Uint8Array(32);
    expect(() => splitKey(dummy, 1, 2)).toThrowError();
    expect(() => splitKey(dummy, 3, 4)).toThrowError();
    expect(() => splitKey(new Uint8Array(0), 3, 2)).toThrowError();
  });
});
