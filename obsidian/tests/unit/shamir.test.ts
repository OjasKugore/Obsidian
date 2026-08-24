/**
 * tests/unit/shamir.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for Shamir's Secret Sharing (lib/crypto/shamir.ts)
 * Includes RSA-OAEP Public Key Shard Wrapping & Unwrapping (Anti-Dealer Backdoor)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  splitKey,
  combineShards,
  parseShard,
  extractShardFromUrl,
  wrapShardWithRSA,
  unwrapShardWithRSA,
  splitAndWrapKey,
} from '@/lib/crypto/shamir';
import {
  generateRSAKeyPair,
  exportPublicKeyBase64,
} from '@/lib/crypto/asymmetric';
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
    expect(parsed?.isRSAWrapped).toBe(false);
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

  // ── RSA Shard Wrapping Tests ───────────────────────────────────────────────

  it('should wrap and unwrap an individual shard with RSA-OAEP', async () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    const shards = splitKey(rawKey, 3, 2);

    const recipientKeyPair = await generateRSAKeyPair();
    const pubKeyBase64 = await exportPublicKeyBase64(recipientKeyPair.publicKey);

    // Wrap shard 1 for recipient
    const wrappedShard = await wrapShardWithRSA(shards[0], pubKeyBase64);
    expect(wrappedShard).toContain('-rsa-');

    const parsedWrapped = parseShard(wrappedShard);
    expect(parsedWrapped?.isRSAWrapped).toBe(true);
    expect(parsedWrapped?.index).toBe(1);

    // Unwrap shard with recipient's private key
    const unwrappedShard = await unwrapShardWithRSA(wrappedShard, recipientKeyPair.privateKey);
    expect(unwrappedShard).toBe(shards[0]);
  });

  it('should split secret and wrap shards across multiple distinct RSA recipients', async () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);

    // Generate 3 distinct recipient keypairs (Alice, Bob, Charlie)
    const alice = await generateRSAKeyPair();
    const bob = await generateRSAKeyPair();
    const charlie = await generateRSAKeyPair();

    const pubAlice = await exportPublicKeyBase64(alice.publicKey);
    const pubBob = await exportPublicKeyBase64(bob.publicKey);
    const pubCharlie = await exportPublicKeyBase64(charlie.publicKey);

    // Split and wrap all 3 shards
    const wrappedShards = await splitAndWrapKey(rawKey, 3, 2, [pubAlice, pubBob, pubCharlie]);
    expect(wrappedShards).toHaveLength(3);
    expect(wrappedShards[0]).toContain('-rsa-');
    expect(wrappedShards[1]).toContain('-rsa-');
    expect(wrappedShards[2]).toContain('-rsa-');

    // Trying to combine wrapped shards directly should fail
    expect(() => combineShards([wrappedShards[0], wrappedShards[1]])).toThrowError(/RSA-wrapped/);

    // Alice and Bob unwrap their respective shards
    const aliceUnwrapped = await unwrapShardWithRSA(wrappedShards[0], alice.privateKey);
    const bobUnwrapped = await unwrapShardWithRSA(wrappedShards[1], bob.privateKey);

    // Combining Alice & Bob's unwrapped shards reconstructs the exact master secret!
    const recoveredKey = combineShards([aliceUnwrapped, bobUnwrapped]);
    expect(recoveredKey).toEqual(rawKey);
  });

  it('should fail unwrapping when wrong private key is used', async () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    const shards = splitKey(rawKey, 3, 2);

    const alice = await generateRSAKeyPair();
    const eve = await generateRSAKeyPair();
    const pubAlice = await exportPublicKeyBase64(alice.publicKey);

    const wrappedForAlice = await wrapShardWithRSA(shards[0], pubAlice);

    // Eve attempts to unwrap Alice's shard with Eve's private key -> rejects
    await expect(unwrapShardWithRSA(wrappedForAlice, eve.privateKey)).rejects.toThrow();
  });

  it('should validate invalid parameters', () => {
    const dummy = new Uint8Array(32);
    expect(() => splitKey(dummy, 1, 2)).toThrowError();
    expect(() => splitKey(dummy, 3, 4)).toThrowError();
    expect(() => splitKey(new Uint8Array(0), 3, 2)).toThrowError();
  });
});
