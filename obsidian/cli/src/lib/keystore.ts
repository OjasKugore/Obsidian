/**
 * cli/src/lib/keystore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Local identity key store — persists RSA keypair in ~/.obsidian-cli/identity.json
 * as base64 PKCS8 / SPKI strings (same format as the browser keystore).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { IDENTITY_FILE, ensureCliDir } from './config.ts';
import {
  generateRSAKeyPair,
  exportPublicKeyBase64,
  exportPrivateKeyBase64,
  importRSAPublicKey,
  importRSAPrivateKey,
  getKeyFingerprint,
} from './crypto.ts';

export interface IdentityRecord {
  publicKeyBase64: string;
  privateKeyBase64: string;
  fingerprint: string;
  createdAt: string;
}

export interface LoadedIdentity extends IdentityRecord {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Generate a new RSA keypair and save it to ~/.obsidian-cli/identity.json */
export async function generateAndSaveIdentityKey(): Promise<IdentityRecord> {
  ensureCliDir();
  const keypair = await generateRSAKeyPair();
  const publicKeyBase64  = await exportPublicKeyBase64(keypair.publicKey);
  const privateKeyBase64 = await exportPrivateKeyBase64(keypair.privateKey);
  const fingerprint = await getKeyFingerprint(keypair.publicKey);

  const record: IdentityRecord = {
    publicKeyBase64,
    privateKeyBase64,
    fingerprint,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(IDENTITY_FILE, JSON.stringify(record, null, 2), 'utf-8');
  return record;
}

/** Load identity key from disk, re-importing fresh CryptoKey handles */
export async function loadIdentityKey(): Promise<LoadedIdentity | null> {
  if (!existsSync(IDENTITY_FILE)) return null;

  const record: IdentityRecord = JSON.parse(readFileSync(IDENTITY_FILE, 'utf-8'));
  const publicKey  = await importRSAPublicKey(record.publicKeyBase64);
  const privateKey = await importRSAPrivateKey(record.privateKeyBase64);

  return { ...record, publicKey, privateKey };
}

/** Check if an identity key exists on disk */
export function hasIdentityKey(): boolean {
  return existsSync(IDENTITY_FILE);
}

/** Export just the private key base64 from disk */
export function getIdentityRecord(): IdentityRecord | null {
  if (!existsSync(IDENTITY_FILE)) return null;
  return JSON.parse(readFileSync(IDENTITY_FILE, 'utf-8'));
}

/** Delete identity key from disk */
export function deleteIdentityKey(): void {
  if (existsSync(IDENTITY_FILE)) {
    const { unlinkSync } = require('fs');
    unlinkSync(IDENTITY_FILE);
  }
}
