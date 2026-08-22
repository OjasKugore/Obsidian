'use client';

import { useState, useCallback } from 'react';
import { encrypt, toBase58 } from '@/lib/crypto/cipher';
import { splitKey } from '@/lib/crypto/shamir';
import type { Expiry, CreatePasteBody, CreatePasteResponse } from '@/lib/api/schemas';

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

      setIsLoading(true);
      setError(null);

      try {
        // 1. Encrypt in browser with AES-256-GCM (client-side only)
        const encResult = await encrypt(plaintext, formatter, {
          burnAfterReading,
          openDiscussion,
        });

        // 2. Prepare API payload
        const payload: CreatePasteBody = {
          v: 2,
          ct: encResult.ciphertext,
          adata: encResult.adata,
          meta: {
            expire,
            burnAfterReading,
            openDiscussion,
            shard: isShamir,
            shardIndex: isShamir ? 1 : undefined,
            shardTotal: isShamir ? totalShares : undefined,
            recipientMode: false,
          },
        };

        // 3. POST to server
        const response = await fetch('/api/v1/paste', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `Server responded with status ${response.status}`
          );
        }

        const data: CreatePasteResponse = await response.json();
        const origin =
          typeof window !== 'undefined' ? window.location.origin : '';
        const keyBase58 = toBase58(encResult.rawKey);

        let shardUrls: ShardUrlItem[] | undefined;
        let primaryShareUrl = `${origin}/${data.pasteId}#${keyBase58}`;

        if (isShamir) {
          // Split the 32-byte AES key into N shards with threshold K
          const shards = splitKey(encResult.rawKey, totalShares, threshold);
          shardUrls = shards.map((shardStr, idx) => ({
            index: idx + 1,
            url: `${origin}/${data.pasteId}#${shardStr}`,
            shardString: shardStr,
          }));
          primaryShareUrl = shardUrls[0]?.url || primaryShareUrl;
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
