'use client';

/**
 * hooks/useAsymmetricEncryption.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestration hook for the RSA-OAEP asymmetric encryption/decryption flow.
 *
 * Responsibilities:
 *   1. Identity key lifecycle (generate, load, check existence)
 *   2. Asymmetric encrypt: AES-256-GCM + RSA-OAEP key wrap → adata[4]
 *   3. Asymmetric decrypt: RSA-OAEP unwrap → raw AES key → cipher.decrypt
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import {
  importRSAPublicKey,
  importRSAPrivateKey,
  wrapAESKey,
  unwrapAESKey,
} from '@/lib/crypto/asymmetric';
import {
  loadIdentityKey,
  generateAndSaveIdentityKey,
  hasIdentityKey,
  purgeKeys,
  type IdentityKeyRecord,
} from '@/lib/crypto/keystore';
import { encrypt, decrypt } from '@/lib/crypto/cipher';
import type { AdataSchema, Expiry } from '@/lib/api/schemas';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AsymEncryptOptions {
  formatter?: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  expire?: Expiry;
  burnAfterReading?: boolean;
  openDiscussion?: boolean;
}

export interface AsymEncryptResult {
  /** Base64 AES-256-GCM ciphertext */
  ciphertext: string;
  /** Full adata array with adata[4] = RSA-OAEP wrapped AES key */
  adata: AdataSchema;
  /** Share URL fragment is always "#asym" — no key in URL */
  fragment: '#asym';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAsymmetricEncryption() {
  const [identityKey, setIdentityKey] = useState<IdentityKeyRecord | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  // ── Load identity key on mount ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const record = await loadIdentityKey();
        if (!cancelled) {
          setIdentityKey(record);
          setIsLoadingKey(false);
        }
      } catch {
        if (!cancelled) {
          setIsLoadingKey(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Generate identity key ──────────────────────────────────────────────────

  const generateIdentityKey = useCallback(async (): Promise<IdentityKeyRecord | null> => {
    setKeyError(null);
    try {
      const record = await generateAndSaveIdentityKey();
      setIdentityKey(record);
      return record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate identity key';
      setKeyError(msg);
      return null;
    }
  }, []);

  // ── Purge identity key ─────────────────────────────────────────────────────

  const purgeIdentityKey = useCallback(async (): Promise<void> => {
    await purgeKeys();
    setIdentityKey(null);
  }, []);

  // ── Encrypt asymmetrically ─────────────────────────────────────────────────

  /**
   * Encrypts plaintext for a specific recipient public key.
   *
   * Flow:
   *   1. AES-256-GCM encrypt (same Tier 1 engine)
   *   2. Import recipient's RSA public key
   *   3. wrapKey(rawAES, rsaPub) → base64 → adata[4]
   *   4. Return { ciphertext, adata (with adata[4]), fragment: '#asym' }
   *
   * The caller (usePasteEncryption) POSTs this to the server with recipientMode: true.
   */
  const encryptAsymmetric = useCallback(
    async (
      plaintext: string,
      recipientPublicKeyBase64: string,
      options: AsymEncryptOptions = {}
    ): Promise<AsymEncryptResult> => {
      const {
        formatter = 'plaintext',
        burnAfterReading = true,
        openDiscussion = false,
      } = options;

      // 1. AES-256-GCM encrypt
      const encResult = await encrypt(plaintext, formatter, {
        burnAfterReading,
        openDiscussion,
      });

      // 2. Import recipient's public key
      let recipientPubKey: CryptoKey;
      try {
        recipientPubKey = await importRSAPublicKey(recipientPublicKeyBase64.trim());
      } catch {
        throw new Error(
          'Invalid recipient public key. Please ensure it is a valid base64-encoded RSA-2048 SPKI key.'
        );
      }

      // 3. Wrap the AES key with RSA-OAEP
      const wrappedKeyBase64 = await wrapAESKey(encResult.rawKey, recipientPubKey);

      // 4. Append wrapped key as adata[4]
      const adataWithWrappedKey = [
        ...encResult.adata,
        wrappedKeyBase64,
      ] as AdataSchema;

      return {
        ciphertext: encResult.ciphertext,
        adata: adataWithWrappedKey,
        fragment: '#asym',
      };
    },
    []
  );

  // ── Decrypt asymmetrically ─────────────────────────────────────────────────

  /**
   * Decrypts an asymmetric paste using the recipient's RSA private key.
   *
   * @param ciphertext  - Base64 AES-GCM ciphertext from server
   * @param adata       - Full adata array (adata[4] = RSA-OAEP wrapped AES key)
   * @param privateKey  - CryptoKey from IndexedDB or manually imported
   * @returns           Decrypted plaintext
   */
  const decryptAsymmetric = useCallback(
    async (
      ciphertext: string,
      adata: AdataSchema,
      privateKey: CryptoKey
    ): Promise<string> => {
      const wrappedKeyBase64 = adata[4];
      if (!wrappedKeyBase64 || typeof wrappedKeyBase64 !== 'string') {
        throw new Error(
          'This paste is marked as asymmetric mode but adata[4] (wrapped key) is missing.'
        );
      }

      // Unwrap the AES key
      let rawAESKey: Uint8Array;
      try {
        rawAESKey = await unwrapAESKey(wrappedKeyBase64, privateKey);
      } catch {
        throw new Error(
          'Decryption failed — your private key does not match the public key used to encrypt this paste.'
        );
      }

      // Decrypt using the recovered AES key
      return decrypt(ciphertext, adata, rawAESKey);
    },
    []
  );

  /**
   * Convenience: decrypt using identity key from IndexedDB.
   */
  const decryptWithIdentityKey = useCallback(
    async (ciphertext: string, adata: AdataSchema): Promise<string> => {
      if (!identityKey) {
        throw new Error(
          'No identity key found. This paste was encrypted for a specific recipient.'
        );
      }
      return decryptAsymmetric(ciphertext, adata, identityKey.privateKey);
    },
    [identityKey, decryptAsymmetric]
  );

  /**
   * Import a private key from a base64 string provided by the user,
   * then decrypt the paste. Optionally persist to sessionStorage for the session.
   */
  const decryptWithImportedKey = useCallback(
    async (
      ciphertext: string,
      adata: AdataSchema,
      privateKeyBase64: string,
      rememberInSession: boolean
    ): Promise<string> => {
      let privateKey: CryptoKey;
      try {
        privateKey = await importRSAPrivateKey(privateKeyBase64.trim());
      } catch {
        throw new Error(
          'Invalid private key. Please paste a valid base64-encoded RSA-2048 PKCS8 private key.'
        );
      }

      if (rememberInSession) {
        sessionStorage.setItem('obsidian-session-privkey', privateKeyBase64.trim());
      }

      return decryptAsymmetric(ciphertext, adata, privateKey);
    },
    [decryptAsymmetric]
  );

  return {
    /** Current identity key (null if not yet generated) */
    identityKey,
    /** True while loading from IndexedDB on mount */
    isLoadingKey,
    /** Error from key generation */
    keyError,
    /** Generate a fresh RSA-2048 keypair and store it */
    generateIdentityKey,
    /** Wipe the identity key from IndexedDB */
    purgeIdentityKey,
    /** Encrypt for a recipient using their public key */
    encryptAsymmetric,
    /** Decrypt using the stored identity private key */
    decryptWithIdentityKey,
    /** Decrypt using an imported base64 private key */
    decryptWithImportedKey,
    /** Raw decrypt with an explicit CryptoKey */
    decryptAsymmetric,
    /** Check whether any identity key exists */
    hasIdentityKey,
  };
}
