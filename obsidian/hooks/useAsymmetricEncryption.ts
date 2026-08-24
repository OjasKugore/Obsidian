'use client';

/**
 * hooks/useAsymmetricEncryption.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestration hook for the RSA-OAEP asymmetric encryption/decryption flow.
 * Manages RSA-2048 identity key lifecycle in IndexedDB and provides methods
 * for recipient-targeted encryption and decryption.
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

export interface AsymEncryptOptions {
  formatter?: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  expire?: Expiry;
  burnAfterReading?: boolean;
  openDiscussion?: boolean;
}

export interface AsymEncryptResult {
  ciphertext: string;
  adata: AdataSchema;
  fragment: '#asym';
}

export function useAsymmetricEncryption() {
  // ── STATE ──────────────────────────────────────────────────────────────

  // RSA-2048 Identity Key record (contains public key base64, private CryptoKey, and fingerprint)
  const [identityKey, setIdentityKey] = useState<IdentityKeyRecord | null>(null);

  // Loading state flag while retrieving key from browser IndexedDB
  const [isLoadingKey, setIsLoadingKey] = useState(true);

  // Error message state if key generation fails
  const [keyError, setKeyError] = useState<string | null>(null);

  // Loads identity key from IndexedDB on component mount
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

  // ── ACTIONS & CRYPTO LOGIC ──────────────────────────────────────────────

  // Generates a new RSA-2048 keypair and saves it to local IndexedDB storage
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

  // Purges stored RSA keypair from IndexedDB and clears local state
  const purgeIdentityKey = useCallback(async (): Promise<void> => {
    await purgeKeys();
    setIdentityKey(null);
  }, []);

  // Encrypts plaintext with AES-256-GCM and wraps the raw AES key using the recipient's RSA public key (stored in adata[4])
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

  // Decrypts an asymmetric paste using a provided RSA private key
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

  // Decrypts paste using the active stored identity private key from IndexedDB
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

  // Imports a base64 PKCS8 RSA private key and uses it to decrypt the paste
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

  // ── RETURN ─────────────────────────────────────────────────────────────

  return {
    identityKey,
    isLoadingKey,
    keyError,
    generateIdentityKey,
    purgeIdentityKey,
    encryptAsymmetric,
    decryptWithIdentityKey,
    decryptWithImportedKey,
    decryptAsymmetric,
    hasIdentityKey,
  };
}
