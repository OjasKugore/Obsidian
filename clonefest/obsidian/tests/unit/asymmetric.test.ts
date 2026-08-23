/**
 * tests/unit/asymmetric.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive unit tests for RSA-2048-OAEP asymmetric encryption & keystore.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateRSAKeyPair,
  exportPublicKeyBase64,
  exportPrivateKeyBase64,
  importRSAPublicKey,
  importRSAPrivateKey,
  wrapAESKey,
  unwrapAESKey,
  getKeyFingerprint,
} from '@/lib/crypto/asymmetric';
import {
  generateAndSaveIdentityKey,
  loadIdentityKey,
  exportIdentityPrivateKeyBase64,
  purgeKeys,
} from '@/lib/crypto/keystore';

// ── In-Memory IndexedDB Mock for Node environment (Vitest) ────────────────────

if (typeof indexedDB === 'undefined') {
  const store = new Map<string, unknown>();

  const fakeDB = {
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => {
          const req: { result?: unknown; onsuccess?: () => void; onerror?: (e: unknown) => void } = {};
          queueMicrotask(() => {
            req.result = store.get(key);
            req.onsuccess?.();
          });
          return req;
        },
        put: (val: unknown, key: string) => {
          const req: { onsuccess?: () => void; onerror?: (e: unknown) => void } = {};
          queueMicrotask(() => {
            store.set(key, val);
            req.onsuccess?.();
          });
          return req;
        },
        delete: (key: string) => {
          const req: { onsuccess?: () => void; onerror?: (e: unknown) => void } = {};
          queueMicrotask(() => {
            store.delete(key);
            req.onsuccess?.();
          });
          return req;
        },
      }),
    }),
    close: () => {},
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
  };

  const fakeOpenReq = {
    result: fakeDB,
    onsuccess: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
    onerror: null as ((e: unknown) => void) | null,
  };

  (globalThis as unknown as Record<string, unknown>).indexedDB = {
    open: () => {
      queueMicrotask(() => {
        fakeOpenReq.onupgradeneeded?.();
        fakeOpenReq.onsuccess?.();
      });
      return fakeOpenReq;
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function randomRawKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('asymmetric.ts — RSA-2048-OAEP primitives', () => {
  it('generateRSAKeyPair returns a valid CryptoKeyPair', async () => {
    const keypair = await generateRSAKeyPair();

    expect(keypair).toBeDefined();
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.privateKey).toBeDefined();
    expect(keypair.publicKey.type).toBe('public');
    expect(keypair.privateKey.type).toBe('private');
    expect(keypair.publicKey.algorithm.name).toBe('RSA-OAEP');
    expect(keypair.privateKey.algorithm.name).toBe('RSA-OAEP');
  }, 15_000);

  it('exportPublicKeyBase64 → importRSAPublicKey is a valid round-trip', async () => {
    const keypair = await generateRSAKeyPair();
    const base64 = await exportPublicKeyBase64(keypair.publicKey);

    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(200);

    const reimported = await importRSAPublicKey(base64);
    expect(reimported.type).toBe('public');
    expect(reimported.algorithm.name).toBe('RSA-OAEP');
  }, 15_000);

  it('wrapAESKey → unwrapAESKey produces the same raw key bytes', async () => {
    const keypair = await generateRSAKeyPair();
    const originalKey = randomRawKey();

    const wrappedBase64 = await wrapAESKey(originalKey, keypair.publicKey);
    expect(typeof wrappedBase64).toBe('string');
    expect(wrappedBase64.length).toBeGreaterThan(100);

    const recovered = await unwrapAESKey(wrappedBase64, keypair.privateKey);
    expect(recovered).toBeInstanceOf(Uint8Array);
    expect(recovered.length).toBe(32);

    for (let i = 0; i < 32; i++) {
      expect(recovered[i]).toBe(originalKey[i]);
    }
  }, 15_000);

  it('unwrapAESKey with wrong private key throws OperationError', async () => {
    const keypairA = await generateRSAKeyPair();
    const keypairB = await generateRSAKeyPair();

    const originalKey = randomRawKey();
    const wrappedBase64 = await wrapAESKey(originalKey, keypairA.publicKey);

    await expect(
      unwrapAESKey(wrappedBase64, keypairB.privateKey)
    ).rejects.toThrow();
  }, 20_000);

  it('getKeyFingerprint returns a 16-char lowercase hex string', async () => {
    const keypair = await generateRSAKeyPair();
    const fp = await getKeyFingerprint(keypair.publicKey);

    expect(typeof fp).toBe('string');
    expect(fp.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(fp)).toBe(true);
  }, 15_000);

  it('two different keypairs produce different fingerprints', async () => {
    const keypairA = await generateRSAKeyPair();
    const keypairB = await generateRSAKeyPair();

    const fpA = await getKeyFingerprint(keypairA.publicKey);
    const fpB = await getKeyFingerprint(keypairB.publicKey);

    expect(fpA).not.toBe(fpB);
  }, 20_000);

  it('exportPrivateKeyBase64 → importRSAPrivateKey round-trip can still unwrap', async () => {
    const keypair = await generateRSAKeyPair();
    const originalKey = randomRawKey();

    const wrappedBase64 = await wrapAESKey(originalKey, keypair.publicKey);

    const privBase64 = await exportPrivateKeyBase64(keypair.privateKey);
    const reimportedPriv = await importRSAPrivateKey(privBase64);

    const recovered = await unwrapAESKey(wrappedBase64, reimportedPriv);
    expect(recovered.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(recovered[i]).toBe(originalKey[i]);
    }
  }, 20_000);
});

describe('keystore.ts — IndexedDB identity persistence & re-import', () => {
  beforeEach(async () => {
    await purgeKeys();
  });

  afterEach(async () => {
    await purgeKeys();
  });

  it('generateAndSaveIdentityKey saves and loadIdentityKey re-imports active keys', async () => {
    const record = await generateAndSaveIdentityKey();
    expect(record).toBeDefined();
    expect(record.publicKeyBase64.length).toBeGreaterThan(100);
    expect(record.fingerprint.length).toBe(16);

    const loaded = await loadIdentityKey();
    expect(loaded).not.toBeNull();
    expect(loaded?.publicKeyBase64).toBe(record.publicKeyBase64);
    expect(loaded?.fingerprint).toBe(record.fingerprint);
    expect(loaded?.publicKey.algorithm.name).toBe('RSA-OAEP');
    expect(loaded?.privateKey.algorithm.name).toBe('RSA-OAEP');
  }, 20_000);

  it('full end-to-end round trip with keystore loaded identity key', async () => {
    // 1. Recipient generates and saves identity key
    const record = await generateAndSaveIdentityKey();

    // 2. Sender wraps AES key using recipient's public key
    const aesKey = randomRawKey();
    const senderImportedPubKey = await importRSAPublicKey(record.publicKeyBase64);
    const wrappedAESBase64 = await wrapAESKey(aesKey, senderImportedPubKey);

    // 3. Recipient loads key from IndexedDB and unwraps AES key
    const loadedRecipient = await loadIdentityKey();
    expect(loadedRecipient).not.toBeNull();

    const unwrappedAES = await unwrapAESKey(wrappedAESBase64, loadedRecipient!.privateKey);

    // 4. Verify exact byte match
    expect(unwrappedAES.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(unwrappedAES[i]).toBe(aesKey[i]);
    }
  }, 25_000);

  it('exportIdentityPrivateKeyBase64 returns PKCS8 string', async () => {
    const record = await generateAndSaveIdentityKey();
    const exportedPriv = await exportIdentityPrivateKeyBase64();

    expect(exportedPriv).not.toBeNull();
    expect(exportedPriv?.length).toBeGreaterThan(200);
  }, 15_000);

  it('purgeKeys removes identity key from IndexedDB', async () => {
    await generateAndSaveIdentityKey();
    let loaded = await loadIdentityKey();
    expect(loaded).not.toBeNull();

    await purgeKeys();
    loaded = await loadIdentityKey();
    expect(loaded).toBeNull();
  }, 15_000);
});
