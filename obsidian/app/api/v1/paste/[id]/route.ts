/**
 * app/api/v1/paste/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * API Route Endpoint Handler.
 * HTTP Methods:
 *   - GET    /api/v1/paste/[id] : Read paste with time-lock check & atomic burn-after-reading
 *   - PUT    /api/v1/paste/[id] : Finalize & update ciphertext from live collab session
 *   - DELETE /api/v1/paste/[id] : Immediate token-validated paste destruction
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import type { GetPasteResponse } from '@/lib/api/schemas';

// ── HELPER UTILITIES & SECURITY HASHER ───────────────────────────────

/** HMAC-SHA256 hasher for validating delete tokens */
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

/** Hashes client IP using HMAC-SHA256 for privacy-compliant logging */
async function hmacIP(rawIP: string): Promise<string> {
  const secret = process.env.IP_HMAC_SECRET ?? 'dev-placeholder';
  return hmacSHA256(rawIP, secret);
}

/** Extracts client IP address from request headers */
function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

// ── GET /api/v1/paste/[id] ───────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Step 1: Rate limit checks
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const ipHash = await hmacIP(getClientIP(request));

  try {
    // Step 2: Atomic Prisma transaction (time-locks, view counters, burn-after-reading)
    const paste = await prisma.$transaction(async (tx) => {
      const found = await tx.paste.findUnique({ where: { id } });
      if (!found) return null;

      // Check expiry timer
      if (found.expiresAt && found.expiresAt < new Date()) {
        await tx.paste.delete({ where: { id } });
        return null;
      }

      // Check time-lock status
      if (found.timelockedUntil && found.timelockedUntil > new Date()) {
        return { __locked: true, timelockedUntil: found.timelockedUntil } as const;
      }

      const newViews = found.views + 1;
      const shouldDestruct =
        found.maxViews !== null && newViews >= found.maxViews;

      // Burn-after-reading: delete and return data atomically
      if (found.burnAfterReading || shouldDestruct) {
        await tx.paste.delete({ where: { id } });
        return { ...found, views: newViews };
      }

      // Standard view count increment
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

    // Step 3: Handle time-locked status response
    if ('__locked' in paste) {
      return NextResponse.json(
        {
          error: 'This paste is time-locked.',
          timelockedUntil: (paste as { timelockedUntil: Date }).timelockedUntil.toISOString(),
        },
        { status: 423 }
      );
    }

    // Step 4: Construct GetPasteResponse payload
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

// ── DELETE /api/v1/paste/[id] ────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Step 1: Parse deleteToken parameter or JSON body
  const { searchParams } = new URL(request.url);
  let deleteToken = searchParams.get('deleteToken');

  if (!deleteToken) {
    try {
      const body = await request.json();
      deleteToken = body.deleteToken;
    } catch {
      // ignore JSON parse error if body empty
    }
  }

  if (!deleteToken) {
    return NextResponse.json({ error: 'deleteToken is required' }, { status: 400 });
  }

  try {
    // Step 2: Fetch salt from database
    const paste = await prisma.paste.findUnique({
      where: { id },
      select: { salt: true },
    });
    if (!paste) {
      return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
    }

    // Step 3: Validate HMAC-SHA256 deletion token
    const expectedToken = await hmacSHA256(id, paste.salt);
    if (deleteToken !== expectedToken) {
      return NextResponse.json({ error: 'Invalid delete token' }, { status: 403 });
    }

    // Step 4: Destroy paste record in database
    await prisma.paste.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/v1/paste/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/v1/paste/[id] ───────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Step 1: Rate limit check
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Step 2: Body parsing & schema validation
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

  // Step 3: Update ciphertext and adata in database
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
