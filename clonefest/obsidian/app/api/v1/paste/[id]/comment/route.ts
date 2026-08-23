/**
 * app/api/v1/paste/[id]/comment/route.ts
 * POST /api/v1/paste/[id]/comment — Add an encrypted comment
 * GET  /api/v1/paste/[id]/comment — List comments for a paste
 * ─────────────────────────────────────────────────────────────────────────────
 * Comments are stored encrypted (same AES-256-GCM cipher as the paste itself).
 * The server never sees plaintext. Comment threads only work on pastes with
 * openDiscussion=true.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreateCommentBodySchema } from '@/lib/api/schemas';

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: pasteId } = await params;

  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Validate paste exists and has open discussion enabled
  const paste = await prisma.paste.findUnique({
    where: { id: pasteId },
    select: { openDiscussion: true },
  });
  if (!paste) {
    return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
  }
  if (!paste.openDiscussion) {
    return NextResponse.json(
      { error: 'Discussion is not enabled for this paste' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateCommentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ct, adata, parentId, icon } = parsed.data;

  const comment = await prisma.comment.create({
    data: {
      pasteId,
      parentId: parentId ?? '',
      ciphertext: ct,
      adata: adata as object,
      icon: icon ?? null,
    },
  });

  return NextResponse.json(
    {
      id: comment.id,
      pasteId: comment.pasteId,
      parentId: comment.parentId,
      ct: comment.ciphertext,
      adata: comment.adata,
      icon: comment.icon,
      createdAt: comment.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: pasteId } = await params;

  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const paste = await prisma.paste.findUnique({
    where: { id: pasteId },
    select: { openDiscussion: true },
  });
  if (!paste) {
    return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
  }
  if (!paste.openDiscussion) {
    return NextResponse.json(
      { error: 'Discussion is not enabled for this paste' },
      { status: 403 }
    );
  }

  const comments = await prisma.comment.findMany({
    where: { pasteId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      pasteId: c.pasteId,
      parentId: c.parentId,
      ct: c.ciphertext,
      adata: c.adata,
      icon: c.icon,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}
