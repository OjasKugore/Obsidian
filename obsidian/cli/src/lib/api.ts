/**
 * cli/src/lib/api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP client for the Obsidian API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getBaseUrl } from './config.ts';

// Valid expiry values accepted by the server schema
export type Expiry = '5min' | '10min' | '1hour' | '1day' | '1week' | '1month' | 'never';

export interface CreatePastePayload {
  v: 2;
  ct: string;
  adata: unknown[];
  meta: {
    expire: Expiry;
    openDiscussion?: boolean;
    burnAfterReading?: boolean;
    recipientMode?: boolean;
    shard?: boolean;
    shardIndex?: number;
    shardTotal?: number;
  };
}

export interface PasteResponse {
  pasteId: string;
  deleteToken?: string;
}

export interface FetchedPaste {
  ct: string;
  adata: unknown[];
  meta?: {
    recipientMode?: boolean;
    shard?: boolean;
    shardIndex?: number | null;
    shardTotal?: number | null;
  };
}

/** POST /api/v1/paste — create a new encrypted paste */
export async function createPaste(payload: CreatePastePayload): Promise<PasteResponse> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/v1/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(`API error ${res.status}: ${err.error ?? res.statusText}`);
  }

  return res.json() as Promise<PasteResponse>;
}

/** GET /api/v1/paste/:id — fetch an encrypted paste by ID */
export async function fetchPaste(id: string): Promise<FetchedPaste> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/v1/paste/${id}`);

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Paste not found or already deleted: ${id}`);
    if (res.status === 410) throw new Error(`Paste has been burned (burn-after-reading): ${id}`);
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<FetchedPaste>;
}

/**
 * Parse paste ID and raw key from an Obsidian URL.
 * URL format: http://host/pasteId#keyBase58  or  http://host/pasteId#asym
 */
export function parseObsidianUrl(url: string): { id: string; fragment: string } {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.replace(/^\//, '').split('/');
    const id = pathParts[pathParts.length - 1];
    const fragment = parsed.hash.replace('#', '');
    if (!id) throw new Error('Could not parse paste ID from URL');
    return { id, fragment };
  } catch {
    throw new Error(`Invalid Obsidian URL: ${url}`);
  }
}

/** Build a shareable Obsidian URL from paste ID and raw key (base58) */
export function buildUrl(pasteId: string, fragment: string): string {
  return `${getBaseUrl()}/${pasteId}#${fragment}`;
}
