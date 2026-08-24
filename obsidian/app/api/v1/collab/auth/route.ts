/**
 * app/api/v1/collab/auth/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * API Route Endpoint Handler.
 * HTTP Methods: POST /api/v1/collab/auth
 * Authenticates Pusher WebSockets presence channel subscriptions for real-time
 * collaborative multi-user paste viewing/editing rooms.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { pusher } from '@/lib/pusher';
import { checkRateLimit } from '@/lib/rate-limit';
import { CollabAuthBodySchema } from '@/lib/api/schemas';

// ── POST /api/v1/collab/auth ───────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: IP Rate limiting check
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Step 2: Form-encoded request body parsing
  let body: unknown;
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    body = {
      socket_id: params.get('socket_id'),
      channel_name: params.get('channel_name'),
    };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Step 3: Zod schema validation
  const parsed = CollabAuthBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid channel auth request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { socket_id, channel_name } = parsed.data;

  // Step 4: Extract paste ID and confirm target paste exists in database
  const pasteId = channel_name.replace('presence-collab-', '');

  const paste = await prisma.paste.findUnique({
    where: { id: pasteId },
    select: { id: true, recipientMode: true },
  });

  if (!paste) {
    return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
  }

  // Step 5: Generate deterministic pseudonym and avatar color from socket_id
  const ADJECTIVES = ['Neon', 'Cipher', 'Quantum', 'Shadow', 'Obsidian', 'Velvet', 'Cobalt', 'Amber', 'Solar', 'Lunar', 'Astral', 'Silver'];
  const ANIMALS = ['Fox', 'Ghost', 'Hawk', 'Lynx', 'Wolf', 'Panther', 'Viper', 'Griffin', 'Falcon', 'Raven', 'Eagle', 'Owl'];
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#6366f1', '#14b8a6'];

  const hash = Math.abs(socket_id.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0));
  const name = `${ADJECTIVES[hash % ADJECTIVES.length]} ${ANIMALS[(hash >> 3) % ANIMALS.length]}`;
  const color = COLORS[hash % COLORS.length];

  const userData = {
    user_id: socket_id,
    user_info: {
      name,
      color,
    },
  };

  // Step 6: Sign Pusher presence channel auth response
  try {
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, userData);
    return NextResponse.json(authResponse);
  } catch (err) {
    console.error('[POST /api/v1/collab/auth]', err);
    return NextResponse.json({ error: 'Channel auth failed' }, { status: 500 });
  }
}
