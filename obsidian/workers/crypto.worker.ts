/**
 * workers/crypto.worker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web Worker for Off-Main-Thread PBKDF2 Key Derivation.
 *
 * Runs PBKDF2-SHA256 (100,000 iterations) in a background Web Worker thread to
 * prevent blocking or stuttering the main UI rendering thread.
 * Exposed to main thread via Comlink proxy RPC wrapping.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as Comlink from 'comlink';
import { deriveKey } from '@/lib/crypto/kdf';

// ── COMLINK WEB WORKER API INTERFACE ─────────────────────────────────

export type CryptoWorkerAPI = {
  /**
   * Derives an AES-256-GCM CryptoKey from raw password bytes and salt.
   *
   * @param password   Raw password bytes
   * @param salt       8-byte random salt
   * @param iterations PBKDF2 iteration count (enforced ≥ 100,000 in kdf.ts)
   */
  deriveKey(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number
  ): Promise<CryptoKey>;
};

// ── WORKER EXPOSURE REGISTER ──────────────────────────────────────────

const api: CryptoWorkerAPI = {
  deriveKey,
};

Comlink.expose(api);
