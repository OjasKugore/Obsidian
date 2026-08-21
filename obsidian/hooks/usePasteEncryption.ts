'use client';

import { useState, useCallback } from 'react';
import { encrypt, toBase58 } from '@/lib/crypto/cipher';
import type { Expiry, CreatePasteBody, CreatePasteResponse } from '@/lib/api/schemas';

export interface EncryptionOptions {
  formatter?: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  expire?: Expiry;
  burnAfterReading?: boolean;
  openDiscussion?: boolean;
}

export interface EncryptionResult {
  pasteId: string;
  shareUrl: string;
  deleteToken: string;
  rawKeyBase58: string;
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
      } = options;

      if (!plaintext.trim()) {
        setError('Paste content cannot be empty.');
        return null;
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
            shard: false,
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

        // 4. Construct Share URL with #base58(rawKey)
        const keyBase58 = toBase58(encResult.rawKey);
        const origin =
          typeof window !== 'undefined' ? window.location.origin : '';
        const shareUrl = `${origin}/${data.pasteId}#${keyBase58}`;

        const res: EncryptionResult = {
          pasteId: data.pasteId,
          shareUrl,
          deleteToken: data.deleteToken,
          rawKeyBase58: keyBase58,
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
