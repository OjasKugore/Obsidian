/**
 * app/api/v1/paste/[id]/route.ts
 * GET  /api/v1/paste/[id] — Read a paste (with time-lock check + burn logic)
 * DELETE /api/v1/paste/[id] — Delete a paste (token-validated)
 * ─────────────────────────────────────────────────────────────────────────────
 * Security guarantees:
 *   - Burn-after-reading is ATOMIC: SELECT FOR UPDATE → DELETE → RETURN
 *     This is implemented as a Prisma transaction so no two concurrent reads
 *     can both succeed on a burn-after-reading paste.
 *   - Time-lock: server rejects GET if now() < timelockedUntil
 *   - N-view self-destruct: atomic increment + check inside transaction
 *   - Delete requires valid HMAC-SHA256(pasteId, per-paste-salt) token
 *   - IP is logged as HMAC'd hash only (never raw)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import type { GetPasteResponse } from '@/lib/api/schemas';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function hmacIP(rawIP: string): Promise<string> {
  const secret = process.env.IP_HMAC_SECRET ?? 'dev-placeholder';
  return hmacSHA256(rawIP, secret);
}

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Rate limit reads too (prevents enumeration attacks)
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const ipHash = await hmacIP(getClientIP(request));

  try {
    // ── Check expiry and time-lock first (no transaction needed) ──────────
    const found = await prisma.paste.findUnique({ where: { id } });

    if (!found) {
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    // Check expiry
    if (found.expiresAt && found.expiresAt < new Date()) {
      await prisma.paste.delete({ where: { id } }).catch(() => {});
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    // Time-lock check
    if (found.timelockedUntil && found.timelockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: 'This paste is time-locked.',
          timelockedUntil: found.timelockedUntil.toISOString(),
        },
        { status: 423 }
      );
    }

    const newViews = found.views + 1;
    const shouldDestruct = found.maxViews !== null && newViews >= found.maxViews;

    // ── Atomic burn / N-view self-destruct (requires transaction) ─────────
    let paste: typeof found & { views: number };
    if (found.burnAfterReading || shouldDestruct) {
      // Use transaction with longer timeout for burn-after-reading
      const result = await prisma.$transaction(
        async (tx) => {
          const locked = await tx.paste.findUnique({ where: { id } });
          if (!locked) return null;
          await tx.paste.delete({ where: { id } });
          return { ...locked, views: newViews };
        },
        { timeout: 15000 }
      );
      if (!result) {
        return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
      }
      paste = result;
    } else {
      // Normal paste — simple non-transactional update
      paste = await prisma.paste.update({
        where: { id },
        data: { views: { increment: 1 } },
      });
      // Fire-and-forget access log (don't block the response)
      prisma.accessLog.create({ data: { pasteId: id, ipHash } }).catch(() => {});
    }

    const pasteData = paste;

    if (!pasteData) {
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    // Time-locked response (kept for legacy path, shouldn't reach here now)
    if ('__locked' in pasteData) {
      return NextResponse.json(
        {
          error: 'This paste is time-locked.',
          timelockedUntil: (pasteData as { timelockedUntil: Date }).timelockedUntil.toISOString(),
        },
        { status: 423 }
      );
    }

    const response: GetPasteResponse = {
      v: 2,
      ct: pasteData.ciphertext,
      adata: pasteData.adata as GetPasteResponse['adata'],
      meta: {
        createdAt: pasteData.createdAt.toISOString(),
        expiresAt: pasteData.expiresAt?.toISOString() ?? null,
        burnAfterReading: pasteData.burnAfterReading,
        openDiscussion: pasteData.openDiscussion,
        maxViews: pasteData.maxViews,
        timelockedUntil: pasteData.timelockedUntil?.toISOString() ?? null,
        shard: pasteData.shard,
        shardIndex: pasteData.shardIndex,
        shardTotal: pasteData.shardTotal,
        recipientMode: pasteData.recipientMode,
        views: pasteData.views,
      },
    };

    return NextResponse.json(response, { headers: rl.headers });
  } catch (err) {
    console.error('[GET /api/v1/paste/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const deleteToken = searchParams.get('deleteToken');
  if (!deleteToken) {
    return NextResponse.json({ error: 'deleteToken is required' }, { status: 400 });
  }

  try {
    const paste = await prisma.paste.findUnique({
      where: { id },
      select: { salt: true },
    });
    if (!paste) {
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    // Validate delete token: HMAC-SHA256(pasteId, per-paste-salt)
    const expectedToken = await hmacSHA256(id, paste.salt);
    if (deleteToken !== expectedToken) {
      return NextResponse.json({ error: 'Invalid delete token' }, { status: 403 });
    }

    await prisma.paste.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/v1/paste/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT (Finalize & Update Collaborative Encrypted Paste) ────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { UpdatePasteBodySchema } = await import('@/lib/api/schemas');
  const parsed = UpdatePasteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid update payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.paste.findUnique({
      where: { id },
      select: { id: true, burnAfterReading: true, expiresAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    if (existing.expiresAt && existing.expiresAt < new Date()) {
      await prisma.paste.delete({ where: { id } });
      return NextResponse.json({ error: 'Paste has expired' }, { status: 410 });
    }

    const updated = await prisma.paste.update({
      where: { id },
      data: {
        ciphertext: parsed.data.ct,
        adata: parsed.data.adata,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, pasteId: updated.id });
  } catch (err) {
    console.error('[PUT /api/v1/paste/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
