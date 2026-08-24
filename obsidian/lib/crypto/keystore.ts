/**
 * lib/crypto/keystore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB-backed RSA identity key persistence.
 *
 * Stores base64 PKCS8 (private) and SPKI (public) strings in IndexedDB.
 * On load, keys are freshly imported using SubtleCrypto (`importRSAPrivateKey` /
 * `importRSAPublicKey`) to guarantee valid, active CryptoKey instances across
 * browser restarts and sessions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  generateRSAKeyPair,
  exportPublicKeyBase64,
  exportPrivateKeyBase64,
  importRSAPrivateKey,
  importRSAPublicKey,
  getKeyFingerprint,
} from './asymmetric';

// ── DATABASE CONSTANTS & SCHEMA TYPES ─────────────────────────────

const DB_NAME    = 'obsidian-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'identity-keys';
const KEY_ID     = 'identity';

export interface IdentityKeyRecord {
  /** The RSA-2048 public key — used to wrap AES keys for others */
  publicKey: CryptoKey;
  /** The RSA-2048 private key — used to unwrap AES keys from others */
  privateKey: CryptoKey;
  /** Base64 SPKI string — cached for quick copy-to-clipboard */
  publicKeyBase64: string;
  /** SHA-256 fingerprint (first 8 bytes, 16 hex chars) */
  fingerprint: string;
  /** ISO timestamp of key creation */
  createdAt: string;
}

interface StoredRecord {
  publicKeyBase64: string;
  privateKeyBase64: string;
  fingerprint: string;
  createdAt: string;
}

// ── INDEXEDDB LOW-LEVEL HELPERS ───────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── RSA IDENTITY KEY PERSISTENCE API ────────────────────────────────

/**
 * Generates a new RSA-2048 keypair and persists base64 strings to IndexedDB.
 */
export async function generateAndSaveIdentityKey(): Promise<IdentityKeyRecord> {
  const keypair = await generateRSAKeyPair();
  const publicKeyBase64 = await exportPublicKeyBase64(keypair.publicKey);
  const privateKeyBase64 = await exportPrivateKeyBase64(keypair.privateKey);
  const fingerprint = await getKeyFingerprint(keypair.publicKey);

  const stored: StoredRecord = {
    publicKeyBase64,
    privateKeyBase64,
    fingerprint,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await dbPut(db, KEY_ID, stored);
  db.close();

  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
    publicKeyBase64,
    fingerprint,
    createdAt: stored.createdAt,
  };
}

/**
 * Loads the identity keypair from IndexedDB, re-importing fresh CryptoKey instances.
 */
export async function loadIdentityKey(): Promise<IdentityKeyRecord | null> {
  try {
    const db = await openDB();
    const stored = await dbGet<StoredRecord>(db, KEY_ID);
    db.close();

    if (!stored || !stored.publicKeyBase64 || !stored.privateKeyBase64) {
      return null;
    }

    const publicKey = await importRSAPublicKey(stored.publicKeyBase64);
    const privateKey = await importRSAPrivateKey(stored.privateKeyBase64);

    return {
      publicKey,
      privateKey,
      publicKeyBase64: stored.publicKeyBase64,
      fingerprint: stored.fingerprint,
      createdAt: stored.createdAt,
    };
  } catch (err) {
    console.error('[loadIdentityKey ERROR]', err);
    return null;
  }
}

/**
 * Checks if an identity key is currently saved in IndexedDB.
 */
export async function hasIdentityKey(): Promise<boolean> {
  const record = await loadIdentityKey();
  return record !== null;
}

/**
 * Saves an imported keypair to IndexedDB.
 */
export async function saveIdentityKey(
  publicKeyBase64: string,
  privateKeyBase64: string
): Promise<IdentityKeyRecord> {
  const publicKey  = await importRSAPublicKey(publicKeyBase64);
  const privateKey = await importRSAPrivateKey(privateKeyBase64);
  const fingerprint = await getKeyFingerprint(publicKey);

  const stored: StoredRecord = {
    publicKeyBase64,
    privateKeyBase64,
    fingerprint,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await dbPut(db, KEY_ID, stored);
  db.close();

  return {
    publicKey,
    privateKey,
    publicKeyBase64,
    fingerprint,
    createdAt: stored.createdAt,
  };
}

/**
 * Exports the stored private key as base64 string.
 */
export async function exportIdentityPrivateKeyBase64(): Promise<string | null> {
  const db = await openDB();
  const stored = await dbGet<StoredRecord>(db, KEY_ID);
  db.close();

  return stored?.privateKeyBase64 ?? null;
}

/**
 * Permanently deletes the identity keypair from IndexedDB.
 */
export async function purgeKeys(): Promise<void> {
  const db = await openDB();
  await dbDelete(db, KEY_ID);
  db.close();
}
