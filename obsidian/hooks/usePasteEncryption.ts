'use client';

/**
 * hooks/usePasteEncryption.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom React hook for client-side paste encryption.
 * Encrypts plaintext in-browser using AES-256-GCM, supports Shamir secret sharing (k-of-n),
 * RSA-OAEP asymmetric key wrapping for targeted recipients, and POSTs payload to backend.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react';
import { encrypt, toBase58 } from '@/lib/crypto/cipher';
import { splitKey } from '@/lib/crypto/shamir';
import { importRSAPublicKey, wrapAESKey } from '@/lib/crypto/asymmetric';
import type { Expiry, CreatePasteBody, CreatePasteResponse, AdataSchema } from '@/lib/api/schemas';

export interface ShardUrlItem {
  index: number;
  url: string;
  shardString: string;
}

export interface EncryptionOptions {
  formatter?: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  expire?: Expiry;
  burnAfterReading?: boolean;
  openDiscussion?: boolean;
  isShamir?: boolean;
  threshold?: number;
  totalShares?: number;
  isAsymmetric?: boolean; /** RSA-OAEP asymmetric mode — recipient's base64 public key */
  recipientPublicKey?: string; /** The recipient's RSA-2048 public key in base64 SPKI format */
}

export interface EncryptionResult {
  pasteId: string;
  shareUrl: string;
  deleteToken: string;
  rawKeyBase58: string;
  isShamir?: boolean;
  threshold?: number;
  totalShares?: number;
  shardUrls?: ShardUrlItem[]; /** True when this was an RSA-OAEP asymmetric paste */
  isAsymmetric?: boolean;
}

export function usePasteEncryption() {
  // ── STATE ──────────────────────────────────────────────────────────────

  // Loading indicator flag during client-side encryption and API network request
  const [isLoading, setIsLoading] = useState(false);

  // Error message state if validation, crypto, or API request fails
  const [error, setError] = useState<string | null>(null);

  // Encryption result output container (contains shareable URL, paste ID, delete token, and shards)
  const [result, setResult] = useState<EncryptionResult | null>(null);

  // ── ACTIONS & CRYPTO LOGIC ──────────────────────────────────────────────

  // Main submission handler: validates input, performs AES-256-GCM encryption, RSA key sealing or Shamir splitting, and POSTs payload
  const encryptAndSubmit = useCallback(
    async (
      plaintext: string,
      options: EncryptionOptions = {}
    ): Promise<EncryptionResult | null> => {
      const {
        formatter = 'plaintext',
        expire = '1day',
        burnAfterReading = true,
        openDiscussion = false,
        isShamir = false,
        threshold = 2,
        totalShares = 3,
        isAsymmetric = false,
        recipientPublicKey = '',
      } = options;

      // Input parameter validations
      if (!plaintext.trim()) {
        setError('Paste content cannot be empty.');
        return null;
      }

      if (isShamir) {
        if (threshold < 2 || totalShares < 2) {
          setError('Threshold and total shares must be at least 2.');
          return null;
        }
        if (threshold > totalShares) {
          setError('Threshold (k) cannot exceed total shares (n).');
          return null;
        }
      }

      if (isAsymmetric && !recipientPublicKey.trim()) {
        setError('Asymmetric mode requires a valid recipient public key.');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Perform client-side AES-256-GCM encryption in browser using SubtleCrypto
        const encResult = await encrypt(plaintext, formatter, {
          burnAfterReading,
          openDiscussion,
        });

        // Step 2: Asymmetric RSA-OAEP path — seal raw AES key with recipient's public key
        let finalAdata: AdataSchema = encResult.adata;
        if (isAsymmetric) {
          let recipientPubKey: CryptoKey;
          try {
            recipientPubKey = await importRSAPublicKey(recipientPublicKey.trim());
          } catch {
            throw new Error(
              'Invalid recipient public key. Ensure it is a valid base64 RSA-2048 SPKI key.'
            );
          }
          const wrappedKeyBase64 = await wrapAESKey(encResult.rawKey, recipientPubKey);
          finalAdata = [...encResult.adata, wrappedKeyBase64] as AdataSchema;
        }

        // Step 3: Construct API request body payload
        const payload: CreatePasteBody = {
          v: 2,
          ct: encResult.ciphertext,
          adata: finalAdata,
          meta: {
            expire,
            burnAfterReading: isShamir ? false : burnAfterReading,
            openDiscussion,
            shard: isShamir,
            shardIndex: isShamir ? 1 : undefined,
            shardTotal: isShamir ? totalShares : undefined,
            recipientMode: isAsymmetric,
          },
        };

        // Step 4: Send encrypted payload to server via POST request
        const response = await fetch('/api/v1/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `Server responded with status ${response.status}`
          );
        }

        const data: CreatePasteResponse = await response.json();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const keyBase58 = toBase58(encResult.rawKey);

        // Step 5: Build final zero-knowledge shareable URLs (Fragment key hash, RSA #asym tag, or Shamir shards)
        let shardUrls: ShardUrlItem[] | undefined;
        let primaryShareUrl: string;

        if (isAsymmetric) {
          primaryShareUrl = `${origin}/${data.pasteId}#asym`;
        } else if (isShamir) {
          const shards = splitKey(encResult.rawKey, totalShares, threshold);
          shardUrls = shards.map((shardStr, idx) => ({
            index: idx + 1,
            url: `${origin}/${data.pasteId}#${shardStr}`,
            shardString: shardStr,
          }));
          primaryShareUrl = shardUrls[0]?.url || `${origin}/${data.pasteId}#${keyBase58}`;
        } else {
          primaryShareUrl = `${origin}/${data.pasteId}#${keyBase58}`;
        }

        const res: EncryptionResult = {
          pasteId: data.pasteId,
          shareUrl: primaryShareUrl,
          deleteToken: data.deleteToken,
          rawKeyBase58: keyBase58,
          isShamir,
          threshold: isShamir ? threshold : undefined,
          totalShares: isShamir ? totalShares : undefined,
          shardUrls,
          isAsymmetric,
        };

        setResult(res);
        return res;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to encrypt and store paste';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Resets error, result, and loading state back to initial values
  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsLoading(false);
  }, []);

  // ── RETURN ─────────────────────────────────────────────────────────────

  return {
    encryptAndSubmit,
    isLoading,
    error,
    result,
    reset,
  };
}
