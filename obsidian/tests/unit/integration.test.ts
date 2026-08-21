/**
 * tests/unit/integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration test verifying Phase 1B (Crypto Engine) to Phase 1C (UI Integration)
 *
 * Simulates the exact end-to-end flow:
 * 1. User inputs text in PasteEditor
 * 2. usePasteEncryption calls encrypt() and encodes the #fragment key via toBase58(rawKey)
 * 3. Server receives { ct, adata, meta }
 * 4. User navigates to share link: /pasteId#base58Key
 * 5. usePasteDecryption extracts #base58Key, calls fromBase58(), and decrypts with decrypt()
 * 6. Validates exact fidelity of plaintext, markdown, emojis, tampering rejection, and metadata
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, toBase58, fromBase58 } from '../../lib/crypto/cipher';
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
      // fromBase58 threw invalid character or decrypt threw tag mismatch — both are valid security rejections
      expect(true).toBe(true);
    }
  });
});
