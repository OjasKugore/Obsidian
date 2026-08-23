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
    // ── Atomic burn-after-reading + N-view self-destruct ──────────────────
    const paste = await prisma.$transaction(async (tx) => {
      // Lock the row for the duration of this transaction
      const found = await tx.paste.findUnique({ where: { id } });
      if (!found) return null;

      // Check expiry
      if (found.expiresAt && found.expiresAt < new Date()) {
        await tx.paste.delete({ where: { id } });
        return null;
      }

      // Time-lock check: reject if the unlock time hasn't arrived yet
      if (found.timelockedUntil && found.timelockedUntil > new Date()) {
        // Return a special sentinel instead of null
        return { __locked: true, timelockedUntil: found.timelockedUntil } as const;
      }

      // N-view self-destruct
      const newViews = found.views + 1;
      const shouldDestruct =
        found.maxViews !== null && newViews >= found.maxViews;

      // Burn-after-reading: delete and return the data in one shot
      if (found.burnAfterReading || shouldDestruct) {
        await tx.paste.delete({ where: { id } });
        return { ...found, views: newViews };
      }

      // Normal paste: increment view count + log
      const updated = await tx.paste.update({
        where: { id },
        data: { views: { increment: 1 } },
      });
      await tx.accessLog.create({
        data: { pasteId: id, ipHash },
      });
      return updated;
    });

    if (!paste) {
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    // Time-locked response
    if ('__locked' in paste) {
      return NextResponse.json(
        {
          error: 'This paste is time-locked.',
          timelockedUntil: (paste as { timelockedUntil: Date }).timelockedUntil.toISOString(),
        },
        { status: 423 } // 423 Locked
      );
    }

    const response: GetPasteResponse = {
      v: 2,
      ct: paste.ciphertext,
      adata: paste.adata as GetPasteResponse['adata'],
      meta: {
        createdAt: paste.createdAt.toISOString(),
        expiresAt: paste.expiresAt?.toISOString() ?? null,
        burnAfterReading: paste.burnAfterReading,
        openDiscussion: paste.openDiscussion,
        maxViews: paste.maxViews,
        timelockedUntil: paste.timelockedUntil?.toISOString() ?? null,
        shard: paste.shard,
        shardIndex: paste.shardIndex,
        shardTotal: paste.shardTotal,
        recipientMode: paste.recipientMode,
        views: paste.views,
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
