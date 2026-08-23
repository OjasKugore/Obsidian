'use client';

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
  /** RSA-OAEP asymmetric mode — recipient's base64 public key */
  isAsymmetric?: boolean;
  /** The recipient's RSA-2048 public key in base64 SPKI format */
  recipientPublicKey?: string;
}

export interface EncryptionResult {
  pasteId: string;
  shareUrl: string;
  deleteToken: string;
  rawKeyBase58: string;
  isShamir?: boolean;
  threshold?: number;
  totalShares?: number;
  shardUrls?: ShardUrlItem[];
  /** True when this was an RSA-OAEP asymmetric paste */
  isAsymmetric?: boolean;
}

export function usePasteEncryption() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EncryptionResult | null>(null);

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
        // 1. AES-256-GCM encrypt in browser (Tier 1 — always the same)
        const encResult = await encrypt(plaintext, formatter, {
          burnAfterReading,
          openDiscussion,
        });

        // 2. Asymmetric RSA-OAEP path: wrap AES key with recipient public key
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
          // Append RSA-OAEP wrapped key as adata[4]
          finalAdata = [...encResult.adata, wrappedKeyBase64] as AdataSchema;
        }

        // 3. Prepare API payload
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

        // 4. POST to server
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

        // 5. Construct share URL
        let shardUrls: ShardUrlItem[] | undefined;
        let primaryShareUrl: string;

        if (isAsymmetric) {
          // No key in URL — just the #asym sentinel
          primaryShareUrl = `${origin}/${data.pasteId}#asym`;
        } else if (isShamir) {
          // Split AES key into N shard fragments
          const shards = splitKey(encResult.rawKey, totalShares, threshold);
          shardUrls = shards.map((shardStr, idx) => ({
            index: idx + 1,
            url: `${origin}/${data.pasteId}#${shardStr}`,
            shardString: shardStr,
          }));
          primaryShareUrl = shardUrls[0]?.url || `${origin}/${data.pasteId}#${keyBase58}`;
        } else {
          // Standard symmetric: key in fragment
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

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsLoading(false);
  }, []);

  return {
    encryptAndSubmit,
    isLoading,
    error,
    result,
    reset,
  };
}
