/**
 * tests/unit/vault.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for Encrypted Paste Vault collection system across:
 *   1. Symmetric AES-256-GCM
 *   2. Asymmetric RSA-OAEP Key Wrapping
 *   3. Shamir's Secret Sharing (SSS) Multi-Party Quorum
 *   4. Hybrid Shamir + RSA-OAEP Per-Shard Wrapping
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { encryptVault, decryptVault } from '@/lib/crypto/vault';
import {
  generateRSAKeyPair,
  exportPublicKeyBase64,
  unwrapAESKey,
} from '@/lib/crypto/asymmetric';
import { combineShards, unwrapShardWithRSA } from '@/lib/crypto/shamir';
import type { EncryptedVaultManifest } from '@/lib/crypto/vault';

describe('Encrypted Paste Vault Engine', () => {
  const sampleManifest: EncryptedVaultManifest = {
    version: 1,
    vaultTitle: 'DevOps Production Cluster Secrets',
    description: 'Kubernetes & Neon DB credentials',
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        title: 'Kubeconfig Manifest',
        content: 'apiVersion: v1\nclusters:\n- cluster:\n    server: https://k8s.cluster.internal',
        formatter: 'syntaxhighlighting',
        tags: ['k8s', 'cluster'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'item-2',
        title: 'Stripe API Key',
        content: 'sk_live_51Nxxxxxxxxxxxxxxxxxxxxxx',
        formatter: 'plaintext',
        tags: ['stripe', 'payments'],
        createdAt: new Date().toISOString(),
      },
    ],
  };

  it('encrypts and decrypts a multi-secret vault manifest round-trip (Symmetric)', async () => {
    const encPkg = await encryptVault(sampleManifest);
    expect(encPkg.ciphertext).toBeDefined();
    expect(encPkg.adata).toBeDefined();
    expect(encPkg.rawKey.length).toBe(32);
    expect(encPkg.keyBase58.length).toBeGreaterThan(30);

    const decrypted = await decryptVault(encPkg.ciphertext, encPkg.adata, encPkg.keyBase58);
    expect(decrypted.vaultTitle).toBe(sampleManifest.vaultTitle);
    expect(decrypted.items.length).toBe(2);
    expect(decrypted.items[0].title).toBe('Kubeconfig Manifest');
    expect(decrypted.items[0].content).toContain('https://k8s.cluster.internal');
    expect(decrypted.items[1].title).toBe('Stripe API Key');
  });

  it('encrypts and decrypts a vault using Asymmetric RSA-OAEP Key Wrapping', async () => {
    const keyPair = await generateRSAKeyPair();
    const pubKeyBase64 = await exportPublicKeyBase64(keyPair.publicKey);

    const encPkg = await encryptVault(sampleManifest, {
      mode: 'asymmetric',
      recipientPublicKey: pubKeyBase64,
    });

    expect(encPkg.isAsymmetric).toBe(true);
    expect(encPkg.adata[4]).toBeDefined();

    // Recipient unwraps with private key
    const rawKey = await unwrapAESKey(
      encPkg.adata[4] as string,
      keyPair.privateKey
    );
    const decrypted = await decryptVault(encPkg.ciphertext, encPkg.adata, rawKey);
    expect(decrypted.vaultTitle).toBe(sampleManifest.vaultTitle);
    expect(decrypted.items.length).toBe(2);
  });

  it('encrypts and decrypts a vault using Shamir Secret Sharing Quorum', async () => {
    const encPkg = await encryptVault(sampleManifest, {
      mode: 'shamir',
      shamirThreshold: 2,
      shamirShares: 3,
    });

    expect(encPkg.isShamir).toBe(true);
    expect(encPkg.shards?.length).toBe(3);

    // Reconstruct with 2 of 3 shards
    const selectedShards = [encPkg.shards![0], encPkg.shards![2]];
    const reconstructedKey = combineShards(selectedShards);

    const decrypted = await decryptVault(encPkg.ciphertext, encPkg.adata, reconstructedKey);
    expect(decrypted.vaultTitle).toBe(sampleManifest.vaultTitle);
    expect(decrypted.items[0].title).toBe('Kubeconfig Manifest');
  });

  it('encrypts and decrypts a vault using Hybrid Shamir + RSA Shard Wrapping', async () => {
    const alice = await generateRSAKeyPair();
    const bob = await generateRSAKeyPair();
    const pubAlice = await exportPublicKeyBase64(alice.publicKey);
    const pubBob = await exportPublicKeyBase64(bob.publicKey);

    const encPkg = await encryptVault(sampleManifest, {
      mode: 'shamir',
      shamirThreshold: 2,
      shamirShares: 2,
      recipientPublicKeys: [pubAlice, pubBob],
    });

    expect(encPkg.shards?.[0]).toContain('-rsa-');
    expect(encPkg.shards?.[1]).toContain('-rsa-');

    // Unwrapping Alice & Bob's shards
    const unwrap1 = await unwrapShardWithRSA(encPkg.shards![0], alice.privateKey);
    const unwrap2 = await unwrapShardWithRSA(encPkg.shards![1], bob.privateKey);

    const reconstructedKey = combineShards([unwrap1, unwrap2]);
    const decrypted = await decryptVault(encPkg.ciphertext, encPkg.adata, reconstructedKey);
    expect(decrypted.vaultTitle).toBe(sampleManifest.vaultTitle);
  });

  it('fails decryption if wrong key is provided', async () => {
    const encPkg = await encryptVault(sampleManifest);
    const wrongKey = new Uint8Array(32); // all zeros

    await expect(decryptVault(encPkg.ciphertext, encPkg.adata, wrongKey)).rejects.toThrow();
  });
});
