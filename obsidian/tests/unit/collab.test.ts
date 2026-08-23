import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto/cipher';
import { fromBase64, toBase64 } from '@/lib/crypto/encoding';

describe('Phase 3: Real-Time E2EE Collaboration Protocol', () => {
  it('encrypts and decrypts real-time collaborative text delta using shared raw AES key', async () => {
    // 1. Generate a 32-byte shared raw AES key for the paste
    const sharedRawKey = crypto.getRandomValues(new Uint8Array(32));

    const updatedText = '# Incident Response War Room\n- Database CPU at 98%\n- Triaging connection pool\n- Resolved via connection scaling';

    // 2. Client A encrypts delta with sharedRawKey
    const encDelta = await encrypt(updatedText, 'markdown', {
      burnAfterReading: false,
      openDiscussion: true,
      customKey: sharedRawKey,
    });

    expect(encDelta.ciphertext).toBeDefined();
    expect(encDelta.ciphertext.length).toBeGreaterThan(20);
    expect(encDelta.adata).toBeDefined();

    // 3. Client B decrypts delta with sharedRawKey
    const decryptedDelta = await decrypt(encDelta.ciphertext, encDelta.adata, sharedRawKey);
    expect(decryptedDelta).toBe(updatedText);
  });

  it('fails to decrypt delta if tampered or wrong key is provided', async () => {
    const correctKey = crypto.getRandomValues(new Uint8Array(32));
    const wrongKey = crypto.getRandomValues(new Uint8Array(32));

    const sensitiveCode = 'const DB_PASSWORD = "super-secret-production-password";';

    const enc = await encrypt(sensitiveCode, 'syntaxhighlighting', {
      burnAfterReading: false,
      openDiscussion: true,
      customKey: correctKey,
    });

    // Attempt decryption with wrong key
    await expect(
      decrypt(enc.ciphertext, enc.adata, wrongKey)
    ).rejects.toThrow();

    // Attempt decryption with tampered ciphertext
    const ctBytes = fromBase64(enc.ciphertext);
    ctBytes[0] ^= 0xff; // flip bits
    const tamperedCt = toBase64(ctBytes);

    await expect(
      decrypt(tamperedCt, enc.adata, correctKey)
    ).rejects.toThrow();
  });

  it('encrypts and decrypts ephemeral typing awareness signal', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));

    const typingPayload = JSON.stringify({
      name: 'Neon Fox',
      isTyping: true,
      timestamp: Date.now(),
    });

    const encSignal = await encrypt(typingPayload, 'plaintext', {
      burnAfterReading: false,
      openDiscussion: true,
      customKey: rawKey,
    });

    const decSignal = await decrypt(encSignal.ciphertext, encSignal.adata, rawKey);
    const parsed = JSON.parse(decSignal);

    expect(parsed.name).toBe('Neon Fox');
    expect(parsed.isTyping).toBe(true);
  });
});
