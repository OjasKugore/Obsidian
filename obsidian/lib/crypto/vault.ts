/**
 * lib/crypto/vault.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Encrypted Paste Vault (Multi-Secret Encrypted Collection).
 *
 * Supports all 3 zero-knowledge delivery tiers:
 *   1. Symmetric URL Hash (#key)
 *   2. Asymmetric RSA-OAEP Key Wrapping (#asym)
 *   3. Shamir's Secret Sharing (SSS) Multi-Party Quorum with optional
 *      individual RSA-OAEP Shard Wrapping (#shard-k-idx-n-rsa-payload)
 *
 * Tier 1 WebCrypto AES-256-GCM + PBKDF2-SHA256 (100,000 iterations).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { encrypt, decrypt, toBase58, fromBase58 } from '@/lib/crypto/cipher';
import { wrapAESKey, importRSAPublicKey } from '@/lib/crypto/asymmetric';
import { splitAndWrapKey } from '@/lib/crypto/shamir';
import type { AdataSchema } from '@/lib/api/schemas';

export interface VaultItem {
  id: string;
  title: string;
  content: string;
  formatter: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  tags: string[];
  createdAt: string;
}

export interface EncryptedVaultManifest {
  version: 1;
  vaultTitle: string;
  description?: string;
  items: VaultItem[];
  updatedAt: string;
}

export interface VaultDeliveryOptions {
  mode?: 'symmetric' | 'asymmetric' | 'shamir';
  customKey?: Uint8Array;
  recipientPublicKey?: string | CryptoKey;
  recipientPublicKeys?: Array<string | CryptoKey | null | undefined>;
  shamirShares?: number;
  shamirThreshold?: number;
}

export interface EncryptedVaultPackage {
  ciphertext: string;
  adata: AdataSchema;
  rawKey: Uint8Array;
  keyBase58: string;
  mode: 'symmetric' | 'asymmetric' | 'shamir';
  isAsymmetric: boolean;
  isShamir: boolean;
  shards?: string[];
  threshold?: number;
  totalShares?: number;
}

/**
 * Encrypts an entire Vault Manifest into an AES-256-GCM package.
 * Supports Symmetric, RSA-OAEP Asymmetric wrapping, and Shamir SSS splitting.
 */
export async function encryptVault(
  manifest: EncryptedVaultManifest,
  options?: VaultDeliveryOptions
): Promise<EncryptedVaultPackage> {
  const mode = options?.mode || 'symmetric';
  const jsonString = JSON.stringify(manifest);

  const encResult = await encrypt(jsonString, 'plaintext', {
    burnAfterReading: false,
    openDiscussion: false,
    customKey: options?.customKey,
  });

  const adata = [...encResult.adata] as AdataSchema;
  let isAsymmetric = false;
  let isShamir = false;
  let shards: string[] | undefined;
  const threshold = options?.shamirThreshold || 2;
  const totalShares = options?.shamirShares || 3;

  if (mode === 'asymmetric' && options?.recipientPublicKey) {
    isAsymmetric = true;
    const rsaPubKey: CryptoKey =
      typeof options.recipientPublicKey === 'string'
        ? await importRSAPublicKey(options.recipientPublicKey)
        : options.recipientPublicKey;

    const wrappedKeyBase64 = await wrapAESKey(encResult.rawKey, rsaPubKey);
    // Store wrapped key in adata[4]
    adata[4] = wrappedKeyBase64;
  } else if (mode === 'shamir') {
    isShamir = true;
    shards = await splitAndWrapKey(
      encResult.rawKey,
      totalShares,
      threshold,
      options?.recipientPublicKeys
    );
  }

  return {
    ciphertext: encResult.ciphertext,
    adata,
    rawKey: encResult.rawKey,
    keyBase58: toBase58(encResult.rawKey),
    mode,
    isAsymmetric,
    isShamir,
    shards,
    threshold,
    totalShares,
  };
}

/**
 * Decrypts an Encrypted Vault Package back into a Vault Manifest.
 */
export async function decryptVault(
  ciphertext: string,
  adata: AdataSchema,
  key: Uint8Array | string
): Promise<EncryptedVaultManifest> {
  const rawKeyBytes = typeof key === 'string' ? fromBase58(key) : key;
  const decryptedJson = await decrypt(ciphertext, adata, rawKeyBytes);
  const manifest = JSON.parse(decryptedJson) as EncryptedVaultManifest;

  if (!manifest.items || !Array.isArray(manifest.items)) {
    throw new Error('Invalid vault package format.');
  }

  return manifest;
}
