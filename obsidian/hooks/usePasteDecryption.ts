'use client';

import { useState, useCallback, useEffect } from 'react';
import { decrypt, fromBase58 } from '@/lib/crypto/cipher';
import type { GetPasteResponse } from '@/lib/api/schemas';

export interface DecryptionState {
  plaintext: string | null;
  formatter: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  meta: GetPasteResponse['meta'] | null;
  isLoading: boolean;
  isDecrypting: boolean;
  error: string | null;
  isBurned: boolean;
  isTimeLocked: boolean;
  timelockedUntil: string | null;
}

export function usePasteDecryption(pasteId: string, autoFetch: boolean = true) {
  const [state, setState] = useState<DecryptionState>({
    plaintext: null,
    formatter: 'plaintext',
    meta: null,
    isLoading: true,
    isDecrypting: false,
    error: null,
    isBurned: false,
    isTimeLocked: false,
    timelockedUntil: null,
  });

  const fetchAndDecrypt = useCallback(async () => {
    if (!pasteId) return;

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      isBurned: false,
    }));

    // 1. Extract key from URL hash (#fragment)
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const keyFragment = hash.startsWith('#') ? hash.slice(1) : hash;

    if (!keyFragment) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          'Decryption key missing from URL fragment (#). The creator did not share the full link.',
      }));
      return;
    }

    try {
      // 2. Fetch encrypted ciphertext & adata from server
      const response = await fetch(`/api/v1/paste/${pasteId}`);

      if (response.status === 404) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isBurned: true,
          error:
            'This paste does not exist or has already been burned after reading.',
        }));
        return;
      }

      if (response.status === 423) {
        const lockedData = await response.json().catch(() => ({}));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isTimeLocked: true,
          timelockedUntil: lockedData.timelockedUntil ?? null,
          error:
            'This paste is time-locked and cannot be decrypted until the unlock date.',
        }));
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Server returned error ${response.status}`
        );
      }

      const data: GetPasteResponse = await response.json();

      // 3. Decrypt client-side
      setState((prev) => ({ ...prev, isLoading: false, isDecrypting: true }));

      let rawKey: Uint8Array;
      try {
        rawKey = fromBase58(keyFragment);
      } catch {
        throw new Error(
          'Invalid Base58 key in URL fragment. The key may be corrupted.'
        );
      }

      const decrypted = await decrypt(data.ct, data.adata, rawKey);
      const formatter = data.adata[1] || 'plaintext';

      setState({
        plaintext: decrypted,
        formatter,
        meta: data.meta,
        isLoading: false,
        isDecrypting: false,
        error: null,
        isBurned: data.meta.burnAfterReading,
        isTimeLocked: false,
        timelockedUntil: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Decryption failed unexpectedly';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isDecrypting: false,
        error: message,
      }));
    }
  }, [pasteId]);

  useEffect(() => {
    if (autoFetch && pasteId) {
      fetchAndDecrypt();
    }
  }, [autoFetch, pasteId, fetchAndDecrypt]);

  return {
    ...state,
    refetch: fetchAndDecrypt,
  };
}
