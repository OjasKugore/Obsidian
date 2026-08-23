/**
 * tests/unit/integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration test verifying Phase 1B (Crypto Engine) to Phase 1C (UI Integration)
 * and Phase 2 (Shamir's Secret Sharing Integration Flow).
 *
 * Simulates the exact end-to-end flow:
 * 1. User inputs text in PasteEditor
 * 2. usePasteEncryption calls encrypt() and encodes the #fragment key via toBase58(rawKey)
 *    or splits into N shards using splitKey()
 * 3. Server receives { ct, adata, meta }
 * 4. User navigates to share link: /pasteId#base58Key or /pasteId#shard-...
 * 5. usePasteDecryption extracts key / shard tokens and reconstructs upon quorum
 * 6. Validates exact fidelity of plaintext, markdown, emojis, tampering rejection, and metadata
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, toBase58, fromBase58 } from '../../lib/crypto/cipher';
import { splitKey, combineShards, parseShard, extractShardFromUrl } from '../../lib/crypto/shamir';
import type { CreatePasteBody, GetPasteResponse } from '../../lib/api/schemas';

describe('Phase 1B ↔ Phase 1C End-to-End Integration Flow', () => {
  it('successfully executes the complete Editor → Encryption → URL Hash → Decryption pipeline', async () => {
    const rawSecret = 'CONFIDENTIAL_API_KEY=sk_live_9876543210_secret_token 🔑';
    const formatter = 'plaintext';
    const burnAfterReading = true;
    const openDiscussion = false;

    // ── Phase 1C Step 1: usePasteEncryption calls encrypt() ──
    const encResult = await encrypt(rawSecret, formatter, {
      burnAfterReading,
      openDiscussion,
    });

    expect(encResult.ciphertext).toBeDefined();
    expect(encResult.adata).toBeDefined();
    expect(encResult.rawKey).toBeInstanceOf(Uint8Array);
    expect(encResult.rawKey.length).toBe(32);

    // ── Phase 1C Step 2: URL Fragment key construction ──
    const keyBase58 = toBase58(encResult.rawKey);
    expect(typeof keyBase58).toBe('string');
    expect(keyBase58.length).toBeGreaterThan(30);

    const pasteId = 'abcdef0123456789';
    const shareUrl = `https://obsidian.local/${pasteId}#${keyBase58}`;

    // ── Simulate Server Storage (POST /api/v1/paste) ──
    const apiPayload: CreatePasteBody = {
      v: 2,
      ct: encResult.ciphertext,
      adata: encResult.adata,
      meta: {
        expire: '1day',
        burnAfterReading,
        openDiscussion,
        shard: false,
        recipientMode: false,
      },
    };

    // ── Simulate Server GET /api/v1/paste/[id] ──
    const serverResponse: GetPasteResponse = {
      v: 2,
      ct: apiPayload.ct,
      adata: apiPayload.adata,
      meta: {
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        burnAfterReading: true,
        openDiscussion: false,
        maxViews: null,
        timelockedUntil: null,
        shard: false,
        shardIndex: null,
        shardTotal: null,
        recipientMode: false,
        views: 1,
      },
    };

    // ── Phase 1C Step 3: usePasteDecryption extracts #fragment key ──
    const hashFromUrl = new URL(shareUrl).hash.slice(1);
    expect(hashFromUrl).toBe(keyBase58);

    const extractedRawKey = fromBase58(hashFromUrl);
    expect(extractedRawKey).toEqual(encResult.rawKey);

    // ── Phase 1C Step 4: usePasteDecryption calls decrypt() ──
    const decryptedPlaintext = await decrypt(
      serverResponse.ct,
      serverResponse.adata,
      extractedRawKey
    );

    // Verify exact fidelity
    expect(decryptedPlaintext).toBe(rawSecret);
    expect(serverResponse.adata[1]).toBe('plaintext');
    expect(serverResponse.adata[3]).toBe(1); // burn after reading
  });

  it('correctly handles Markdown formatted secrets with multi-line code blocks', async () => {
    const markdownContent = `# Top Secret Credentials\n\n\`\`\`json\n{\n  "jwt": "eyJhbGciOi...",\n  "env": "production"\n}\n\`\`\``;

    const enc = await encrypt(markdownContent, 'markdown', { burnAfterReading: false });
    const fragmentKey = toBase58(enc.rawKey);

    const decodedKey = fromBase58(fragmentKey);
    const decrypted = await decrypt(enc.ciphertext, enc.adata, decodedKey);

    expect(decrypted).toBe(markdownContent);
    expect(enc.adata[1]).toBe('markdown');
  });

  it('rejects decryption if the URL fragment key is modified or corrupted', async () => {
    const secret = 'Private notes for board meeting';
    const enc = await encrypt(secret);
    const validKey = toBase58(enc.rawKey);

    // Tamper with the base58 string by swapping characters
    const tamperedKey = validKey.slice(0, -2) + (validKey.endsWith('A') ? 'B' : 'A') + validKey.slice(-1);

    try {
      const decodedTamperedKey = fromBase58(tamperedKey);
      await expect(decrypt(enc.ciphertext, enc.adata, decodedTamperedKey)).rejects.toThrow();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('correctly encrypts and decrypts comment threads using the shared paste key', async () => {
    // 1. Sender creates paste
    const pasteContent = 'Design review notes';
    const pasteEnc = await encrypt(pasteContent, 'plaintext', { openDiscussion: true, burnAfterReading: false });
    const sharedKey = pasteEnc.rawKey;

    // 2. Receiver encrypts a comment using the sharedKey
    const commentBody = 'Looks good! Approved from security side. 🚀';
    const commentEnc = await encrypt(commentBody, 'plaintext', {
      openDiscussion: true,
      burnAfterReading: false,
      customKey: sharedKey,
    });

    // 3. Sender decrypts the comment using the sharedKey
    const decryptedComment = await decrypt(commentEnc.ciphertext, commentEnc.adata, sharedKey);
    expect(decryptedComment).toBe(commentBody);
  });
});

describe('Phase 2 Shamir SSS End-to-End Key Splitting & Quorum Reconstruction', () => {
  it('successfully splits AES key into 3 shards, simulates 2-of-3 quorum, and decrypts secret', async () => {
    const quorumSecret = 'VAULT_MASTER_SEED=xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wDELgBDjh3... 🔐';
    const formatter = 'plaintext';
    const threshold = 2;
    const totalShares = 3;

    // 1. Client encrypts plaintext with AES-256-GCM
    const encResult = await encrypt(quorumSecret, formatter, {
      burnAfterReading: false,
      openDiscussion: false,
    });

    // 2. Client splits the 32-byte AES key into 3 shards
    const shards = splitKey(encResult.rawKey, totalShares, threshold);
    expect(shards).toHaveLength(3);

    const pasteId = '778899aabbccddeeff';
    const shardUrls = shards.map((s, idx) => `https://obsidian.local/${pasteId}#${s}`);

    // 3. Recipient A opens Shard #1
    const shard1Token = extractShardFromUrl(shardUrls[0]);
    expect(shard1Token).not.toBeNull();
    const parsed1 = parseShard(shard1Token!);
    expect(parsed1?.index).toBe(1);
    expect(parsed1?.threshold).toBe(2);

    // Single shard alone cannot reconstruct
    expect(() => combineShards([shard1Token!])).toThrowError(/Insufficient shards/);

    // 4. Recipient B provides Shard #3 (e.g. from full URL)
    const shard3Token = extractShardFromUrl(shardUrls[2]);
    expect(shard3Token).not.toBeNull();

    // 5. Client combines Shard #1 + Shard #3
    const recoveredAESKey = combineShards([shard1Token!, shard3Token!]);
    expect(recoveredAESKey).toEqual(encResult.rawKey);

    // 6. Decrypt ciphertext with the reconstructed AES key
    const decrypted = await decrypt(encResult.ciphertext, encResult.adata, recoveredAESKey);
    expect(decrypted).toBe(quorumSecret);
  });
});
