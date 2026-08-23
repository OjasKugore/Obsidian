/**
 * workers/crypto.worker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Worker that offloads PBKDF2 key derivation off the main thread.
 *
 * PBKDF2 at 100,000 iterations takes ~300-600ms synchronously, which would
 * freeze the UI. Running it here keeps the main thread responsive.
 *
 * Exposed via Comlink so callers get a typed async interface:
 *
 *   import * as Comlink from 'comlink';
 *   const worker = new Worker(new URL('./crypto.worker.ts', import.meta.url));
 *   const api = Comlink.wrap<CryptoWorkerAPI>(worker);
 *   const key = await api.deriveKey(password, salt, 100_000);
 *
 * Security constraint §2: PBKDF2 runs here, never on the main thread.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as Comlink from 'comlink';
import { deriveKey } from '@/lib/crypto/kdf';

/**
 * The API surface exposed to the main thread via Comlink.
 * Keep this minimal — only what the main thread needs to call.
 */
export type CryptoWorkerAPI = {
  /**
   * Derives an AES-256-GCM CryptoKey from raw password bytes and salt.
   *
   * NOTE: CryptoKey objects are transferable across the worker boundary in
   * modern browsers, so this returns the actual CryptoKey (not raw bytes).
   *
   * @param password   Raw bytes (random 32-byte entropy for symmetric mode)
   * @param salt       8-byte random salt (stored in adata[0][1])
   * @param iterations PBKDF2 iteration count (enforced ≥ 100,000 in kdf.ts)
   */
  deriveKey(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number
  ): Promise<CryptoKey>;
};

const api: CryptoWorkerAPI = {
  deriveKey,
};

Comlink.expose(api);
