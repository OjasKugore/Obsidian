'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { decrypt, fromBase58 } from '@/lib/crypto/cipher';
import {
  parseShard,
  combineShards,
  extractShardFromUrl,
  unwrapShardWithRSA,
} from '@/lib/crypto/shamir';
import { unwrapAESKey } from '@/lib/crypto/asymmetric';
import { loadIdentityKey } from '@/lib/crypto/keystore';
import type { GetPasteResponse } from '@/lib/api/schemas';

export interface DecryptionState {
  plaintext: string | null;
  formatter: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  meta: GetPasteResponse['meta'] | null;
  rawKey: Uint8Array | null;
  isLoading: boolean;
  isDecrypting: boolean;
  error: string | null;
  isBurned: boolean;
  isTimeLocked: boolean;
  timelockedUntil: string | null;

  // Shamir Quorum State
  isShamir: boolean;
  threshold: number;
  totalShards: number;
  loadedShards: { index: number; shardString: string }[];
  isQuorumNeeded: boolean;

  // Asymmetric RSA-OAEP State
  isAsymmetric: boolean;
  isAwaitingPrivateKey: boolean;
}

export function usePasteDecryption(pasteId: string, autoFetch: boolean = true) {
  const isFetchingRef = useRef(false);
  const hasSucceededRef = useRef(false);
  const fetchedPasteDataRef = useRef<GetPasteResponse | null>(null);
  const shardMapRef = useRef<Map<number, string>>(new Map());

  const [state, setState] = useState<DecryptionState>({
    plaintext: null,
    formatter: 'plaintext',
    meta: null,
    rawKey: null,
    isLoading: true,
    isDecrypting: false,
    error: null,
    isBurned: false,
    isTimeLocked: false,
    timelockedUntil: null,
    isShamir: false,
    threshold: 2,
    totalShards: 2,
    loadedShards: [],
    isQuorumNeeded: false,
    isAsymmetric: false,
    isAwaitingPrivateKey: false,
  });

  const decryptWithKey = useCallback(
    async (
      key: Uint8Array,
      data: GetPasteResponse
    ) => {
      setState((prev) => ({ ...prev, isDecrypting: true, error: null }));
      try {
        const decrypted = await decrypt(data.ct, data.adata, key);
        const formatter = data.adata[1] || 'plaintext';
        hasSucceededRef.current = true;

        setState((prev) => ({
          ...prev,
          plaintext: decrypted,
          formatter,
          meta: data.meta,
          rawKey: key,
          isLoading: false,
          isDecrypting: false,
          error: null,
          isBurned: false,
          isTimeLocked: false,
          timelockedUntil: null,
          isQuorumNeeded: false,
          isAwaitingPrivateKey: false,
        }));
      } catch (err: unknown) {
        console.error('[decryptWithKey ERROR]', err);
        const message =
          err instanceof Error
            ? err.message
            : 'Decryption failed with the provided key.';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isDecrypting: false,
          error: message,
        }));
      }
    },
    []
  );

  const attemptShamirReconstruction = useCallback(
    async (data: GetPasteResponse, threshold: number) => {
      const shards = Array.from(shardMapRef.current.values());
      const loadedList = Array.from(shardMapRef.current.entries()).map(
        ([index, shardString]) => ({ index, shardString })
      );

      if (shards.length < threshold) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isDecrypting: false,
          isQuorumNeeded: true,
          loadedShards: loadedList,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isDecrypting: true,
        loadedShards: loadedList,
      }));

      try {
        const recoveredKey = combineShards(shards);
        await decryptWithKey(recoveredKey, data);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to reconstruct secret from shards.';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isDecrypting: false,
          error: message,
        }));
      }
    },
    [decryptWithKey]
  );

  const fetchAndDecrypt = useCallback(async () => {
    if (isFetchingRef.current || hasSucceededRef.current) return;
    isFetchingRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Extract key fragment from URL hash
      const keyFragment =
        typeof window !== 'undefined'
          ? window.location.hash.replace(/^#/, '')
          : '';

      // 2. Fetch encrypted paste metadata + ciphertext from server
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
      fetchedPasteDataRef.current = data;

      // 3. Detect if this is a Shamir SSS shard
      const parsedInitialShard = parseShard(keyFragment);

      if (parsedInitialShard || data.meta.shard) {
        const threshold =
          parsedInitialShard?.threshold ?? (data.meta.shardIndex ? 2 : 2);
        const total =
          parsedInitialShard?.total ?? data.meta.shardTotal ?? threshold;

        if (parsedInitialShard) {
          let shardToStore = parsedInitialShard.rawString;

          // If shard is RSA-wrapped, attempt automatic unwrapping using local IndexedDB identity key
          if (parsedInitialShard.isRSAWrapped) {
            try {
              const idKey = await loadIdentityKey();
              if (idKey?.privateKey) {
                shardToStore = await unwrapShardWithRSA(
                  parsedInitialShard.rawString,
                  idKey.privateKey
                );
              }
            } catch {
              // Will prompt user or request private key
            }
          }

          const parsedUnwrapped = parseShard(shardToStore);
          if (parsedUnwrapped && !parsedUnwrapped.isRSAWrapped) {
            shardMapRef.current.set(parsedUnwrapped.index, parsedUnwrapped.rawString);
          }
        }

        setState((prev) => ({
          ...prev,
          isShamir: true,
          threshold,
          totalShards: total,
          meta: data.meta,
        }));

        await attemptShamirReconstruction(data, threshold);
        return;
      }

      // 4. Asymmetric RSA-OAEP mode: #asym sentinel → show private key prompt
      if (keyFragment === 'asym' || data.meta.recipientMode) {
        // Try auto-unlocking with IndexedDB identity key if present
        try {
          const idKey = await loadIdentityKey();
          if (idKey?.privateKey && data.adata[4]) {
            const rawAESKey = await unwrapAESKey(data.adata[4] as string, idKey.privateKey);
            await decryptWithKey(rawAESKey, data);
            return;
          }
        } catch {
          // Fall through to manual unlock prompt
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isDecrypting: false,
          isAsymmetric: true,
          isAwaitingPrivateKey: true,
          meta: data.meta,
        }));
        return;
      }

      // 5. Standard symmetric decryption
      setState((prev) => ({ ...prev, isLoading: false, isDecrypting: true }));

      let rawKey: Uint8Array;
      try {
        rawKey = fromBase58(keyFragment);
      } catch {
        throw new Error(
          'Invalid Base58 key in URL fragment. The key may be corrupted.'
        );
      }

      await decryptWithKey(rawKey, data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Decryption failed unexpectedly';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isDecrypting: false,
        error: message,
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [pasteId, decryptWithKey, attemptShamirReconstruction]);

  /**
   * Adds an additional shard token or URL to the quorum pool and triggers reconstruction if threshold is met.
   */
  const addShard = useCallback(
    async (input: string): Promise<{ success: boolean; error?: string }> => {
      let shardStr = extractShardFromUrl(input) || input.trim();
      let parsed = parseShard(shardStr);

      if (!parsed) {
        return {
          success: false,
          error:
            'Invalid shard format. Please paste a valid shard token or full shard link.',
        };
      }

      // If shard is RSA-wrapped, attempt automatic unwrap with local identity key
      if (parsed.isRSAWrapped) {
        const shardIndex = parsed.index;
        try {
          const idKey = await loadIdentityKey();
          if (idKey?.privateKey) {
            shardStr = await unwrapShardWithRSA(shardStr, idKey.privateKey);
            parsed = parseShard(shardStr);
          } else {
            return {
              success: false,
              error: `Shard #${shardIndex} is RSA-encrypted for a specific recipient. Import your private key in the Identity panel first.`,
            };
          }
        } catch {
          return {
            success: false,
            error: `Shard #${shardIndex} is RSA-encrypted and failed to unwrap with your private key.`,
          };
        }
      }

      if (!parsed || parsed.isRSAWrapped) {
        return {
          success: false,
          error: 'Failed to unwrap RSA encrypted shard.',
        };
      }

      if (shardMapRef.current.has(parsed.index)) {
        return {
          success: false,
          error: `Shard #${parsed.index} has already been provided.`,
        };
      }

      shardMapRef.current.set(parsed.index, parsed.rawString);

      const targetData = fetchedPasteDataRef.current;
      if (targetData) {
        await attemptShamirReconstruction(targetData, parsed.threshold);
      } else {
        const loadedList = Array.from(shardMapRef.current.entries()).map(
          ([index, shardString]) => ({ index, shardString })
        );
        setState((prev) => ({ ...prev, loadedShards: loadedList }));
      }

      return { success: true };
    },
    [attemptShamirReconstruction]
  );

  /**
   * Called from PrivateKeyUnlock when the user provides their RSA private key.
   * Unwraps the AES key from adata[4] and decrypts the paste.
   */
  const decryptWithPrivateKey = useCallback(
    async (privateKey: CryptoKey) => {
      const data = fetchedPasteDataRef.current;
      if (!data) {
        setState((prev) => ({
          ...prev,
          error: 'Paste data not loaded yet. Please refresh.',
        }));
        return;
      }

      const wrappedKeyBase64 = data.adata[4];
      if (!wrappedKeyBase64 || typeof wrappedKeyBase64 !== 'string') {
        setState((prev) => ({
          ...prev,
          error: 'This paste is marked as asymmetric mode but adata[4] is missing.',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isDecrypting: true,
        isAwaitingPrivateKey: false,
        error: null,
      }));

      try {
        const rawAESKey = await unwrapAESKey(wrappedKeyBase64, privateKey);
        await decryptWithKey(rawAESKey, data);
      } catch (err: unknown) {
        console.error('[decryptWithPrivateKey ERROR]', err);
        let message = 'Decryption failed — wrong private key or corrupted data.';
        if (err instanceof Error && err.name === 'OperationError') {
          message = 'Key Mismatch: Your current RSA private key does not match the public key used to encrypt this paste.';
        } else if (err instanceof Error) {
          message = err.message;
        }
        setState((prev) => ({
          ...prev,
          isDecrypting: false,
          isAwaitingPrivateKey: true,
          error: message,
        }));
      }
    },
    [decryptWithKey]
  );

  useEffect(() => {
    if (autoFetch && pasteId && !hasSucceededRef.current && !isFetchingRef.current) {
      fetchAndDecrypt();
    }
  }, [autoFetch, pasteId, fetchAndDecrypt]);

  return {
    ...state,
    addShard,
    decryptWithPrivateKey,
    refetch: () => {
      hasSucceededRef.current = false;
      isFetchingRef.current = false;
      shardMapRef.current.clear();
      return fetchAndDecrypt();
    },
  };
}
