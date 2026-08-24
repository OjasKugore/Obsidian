/**
 * app/api/v1/paste/[id]/comment/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * API Route Endpoint Handler.
 * HTTP Methods:
 *   - POST /api/v1/paste/[id]/comment : Post end-to-end encrypted discussion comment
 *   - GET  /api/v1/paste/[id]/comment : List encrypted discussion thread comments
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { CreateCommentBodySchema } from '@/lib/api/schemas';

// ── POST /api/v1/paste/[id]/comment ───────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: pasteId } = await params;

  // Step 1: IP Rate limiting check
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Step 2: Validate target paste existence and openDiscussion permission
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

  // Step 3: Request body parsing and Zod schema validation
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

  // Step 4: Write encrypted comment record to PostgreSQL database
  const comment = await prisma.comment.create({
    data: {
      pasteId,
      parentId: parentId ?? '',
      ciphertext: ct,
      adata: adata as object,
      icon: icon ?? null,
    },
  });

  // Step 5: Return 201 Created JSON response
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

// ── GET /api/v1/paste/[id]/comment ────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: pasteId } = await params;

  // Step 1: IP Rate limiting check
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Step 2: Validate target paste existence and openDiscussion permission
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

  // Step 3: Fetch all encrypted comments for thread ordered chronologically
  const comments = await prisma.comment.findMany({
    where: { pasteId },
    orderBy: { createdAt: 'asc' },
  });

  // Step 4: Return JSON comments list response
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
