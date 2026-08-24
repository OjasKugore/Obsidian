/**
 * app/api/v1/paste/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * API Route Endpoint Handler.
 * HTTP Methods: POST /api/v1/paste
 * Validates v2 wire-format payload, enforces IP rate-limits, and persists encrypted
 * paste records to PostgreSQL database via Prisma ORM.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreatePasteBodySchema, EXPIRY_SECONDS } from '@/lib/api/schemas';
import type { CreatePasteResponse } from '@/lib/api/schemas';

// ── HELPER UTILITIES & HASHER FUNCTIONS ────────────────────────────────

/** FNV-1a 64-bit hash — returns 16 lowercase hex chars (BigInt-free) */
function fnv1a64(data: string): string {
  let hi = 0xcbf29ce4 >>> 0;
  let lo = 0x84222325 >>> 0;

  for (const byte of new TextEncoder().encode(data)) {
    lo = (lo ^ byte) >>> 0;

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

// ── POST /api/v1/paste ────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: IP Rate Limiting Check (10 req/10s per HMAC'd IP)
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rl.headers }
    );
  }

  // Step 2: Request JSON Body Parsing & Zod Schema Validation
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

  // Step 3: Compute Paste ID (fnv1a64) and Secret Delete Token (HMAC-SHA256)
  const pasteId = fnv1a64(ct);
  const salt = randomHex(32);
  const deleteToken = await hmacSHA256(pasteId, salt);

  // Step 4: Expiration & Time-Lock Date Calculations
  const expirySeconds = EXPIRY_SECONDS[meta.expire];
  const expiresAt = expirySeconds
    ? new Date(Date.now() + expirySeconds * 1000)
    : null;

  const timelockedUntil = meta.timelockedUntil
    ? new Date(meta.timelockedUntil)
    : null;

  // Step 5: Write Encrypted Paste Record to PostgreSQL via Prisma ORM
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
      return NextResponse.json<CreatePasteResponse>(
        { pasteId, deleteToken },
        { status: 200, headers: rl.headers }
      );
    }
    console.error('[POST /api/v1/paste]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Step 6: Return Created JSON Response ({ pasteId, deleteToken })
  return NextResponse.json<CreatePasteResponse>(
    { pasteId, deleteToken },
    { status: 201, headers: rl.headers }
  );
}
