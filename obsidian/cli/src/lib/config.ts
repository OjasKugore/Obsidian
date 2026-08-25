/**
 * cli/src/lib/config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CLI configuration — base URL, config file path resolution.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

/** Root directory for all CLI config and key files */
export const CLI_DIR = join(homedir(), '.obsidian-cli');

/** Identity key storage file */
export const IDENTITY_FILE = join(CLI_DIR, 'identity.json');

/** Config file */
export const CONFIG_FILE = join(CLI_DIR, 'config.json');

/** Ensure ~/.obsidian-cli/ exists */
export function ensureCliDir(): void {
  mkdirSync(CLI_DIR, { recursive: true });
}

/**
 * Get the base URL for the Obsidian API.
 * Priority: OBSIDIAN_URL env → config file → default localhost
 */
export function getBaseUrl(): string {
  if (process.env.OBSIDIAN_URL) return process.env.OBSIDIAN_URL.replace(/\/$/, '');

  try {
    const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    if (cfg.url) return (cfg.url as string).replace(/\/$/, '');
  } catch { /* no config file */ }

  return 'http://localhost:3000';
}

export function setBaseUrl(url: string): void {
  ensureCliDir();
  let cfg: Record<string, unknown> = {};
  try { cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { /* fresh */ }
  cfg.url = url;
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}
