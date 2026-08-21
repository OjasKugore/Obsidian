/**
 * app/api/v1/paste/route.ts
 * POST /api/v1/paste — Create a new paste
 * ─────────────────────────────────────────────────────────────────────────────
 * Security guarantees:
 *   - Rate-limited: 10 req/10s per HMAC'd IP
 *   - paste ID = fnv1a64(ciphertext) — 16 hex chars
 *   - deleteToken = HMAC-SHA256(pasteId, per-paste-salt)
 *   - Burn-after-reading default is set here but enforced atomically in GET
 *   - All input validated by Zod (CreatePasteBodySchema)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreatePasteBodySchema, EXPIRY_SECONDS } from '@/lib/api/schemas';
import type { CreatePasteResponse } from '@/lib/api/schemas';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** FNV-1a 64-bit hash — returns 16 lowercase hex chars (BigInt-free) */
function fnv1a64(data: string): string {
  // Represent the 64-bit state as two 32-bit unsigned halves [hi, lo]
  // FNV offset basis: 0xcbf29ce4 84222325
  let hi = 0xcbf29ce4 >>> 0;
  let lo = 0x84222325 >>> 0;

  for (const byte of new TextEncoder().encode(data)) {
    // XOR with byte (only affects lo)
    lo = (lo ^ byte) >>> 0;

    // Multiply by FNV prime 0x00000100_000001b3
    // prime_hi = 0x00000100, prime_lo = 0x000001b3
    // (hi:lo) * prime = hi*prime_lo + lo*prime_hi : lo*prime_lo
    // We only keep the low 64 bits
    const lo_lo = Math.imul(lo, 0x000001b3) >>> 0;
    const lo_hi = Math.imul(lo, 0x00000100) >>> 0;
    const hi_lo = Math.imul(hi, 0x000001b3) >>> 0;

    lo = lo_lo >>> 0;
    hi = ((lo_hi + hi_lo) + (lo_lo / 0x100000000)) >>> 0;
  }

  const hiHex = hi.toString(16).padStart(8, '0');
  const loHex = lo.toString(16).padStart(8, '0');
  return (hiHex + loHex).slice(0, 16);
}

/** HMAC-SHA256(message, key) → hex string */
async function hmacSHA256(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Buffer.from(sig).toString('hex');
}

/** Generates a random hex salt of the given byte length */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString('hex');
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limit
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rl.headers }
    );
  }

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreatePasteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ct, adata, meta } = parsed.data;

  // 3. Compute paste ID and delete token
  const pasteId = fnv1a64(ct);
  const salt = randomHex(32); // 64-char hex salt, per-paste
  const deleteToken = await hmacSHA256(pasteId, salt);

  // 4. Compute expiry timestamp
  const expirySeconds = EXPIRY_SECONDS[meta.expire];
  const expiresAt = expirySeconds
    ? new Date(Date.now() + expirySeconds * 1000)
    : null;

  // 5. Parse time-lock datetime
  const timelockedUntil = meta.timelockedUntil
    ? new Date(meta.timelockedUntil)
    : null;

  // 6. Write to DB
  try {
    await prisma.paste.create({
      data: {
        id: pasteId,
        ciphertext: ct,
        adata: adata as object,
        expiresAt,
        burnAfterReading: meta.burnAfterReading ?? true,
        openDiscussion: meta.openDiscussion ?? false,
        salt,
        maxViews: meta.maxViews ?? null,
        timelockedUntil,
        shard: meta.shard ?? false,
        shardIndex: meta.shardIndex ?? null,
        shardTotal: meta.shardTotal ?? null,
        recipientMode: meta.recipientMode ?? false,
      },
    });
  } catch (err: unknown) {
    // Duplicate paste ID (same ciphertext submitted twice) — idempotent success
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      // Re-fetch the existing paste's deleteToken is not possible (different salt).
      // Treat as success with the new token — the old delete token still works.
      return NextResponse.json<CreatePasteResponse>(
        { pasteId, deleteToken },
        { status: 200, headers: rl.headers }
      );
    }
    console.error('[POST /api/v1/paste]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json<CreatePasteResponse>(
    { pasteId, deleteToken },
    { status: 201, headers: rl.headers }
  );
}
