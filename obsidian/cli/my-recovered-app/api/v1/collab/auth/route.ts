/**
 * app/api/v1/collab/auth/route.ts
 * POST /api/v1/collab/auth — Pusher presence channel authentication stub
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1: This is a stub that validates the channel name format and confirms
 * the paste exists. Phase 3 will add full presence user data + Yjs integration.
 *
 * Pusher requires the server to sign channel auth requests so clients can't
 * subscribe to arbitrary private/presence channels they don't own.
 *
 * Zero-knowledge guarantee: the server only confirms the paste exists.
 * It never receives or stores decryption keys.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { pusher } from '@/lib/pusher';
import { checkRateLimit } from '@/lib/rate-limit';
import { CollabAuthBodySchema } from '@/lib/api/schemas';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    // Pusher sends channel auth as form-encoded body
    const text = await request.text();
    const params = new URLSearchParams(text);
    body = {
      socket_id: params.get('socket_id'),
      channel_name: params.get('channel_name'),
    };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const parsed = CollabAuthBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid channel auth request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { socket_id, channel_name } = parsed.data;

  // Extract paste ID from channel name: "presence-collab-{pasteId}"
  const pasteId = channel_name.replace('presence-collab-', '');

  // Confirm the paste exists (asymmetric pastes allowed for read-only collab view)
  const paste = await prisma.paste.findUnique({
    where: { id: pasteId },
    select: { id: true, recipientMode: true },
  });

  if (!paste) {
    return NextResponse.json({ error: 'Paste not found' }, { status: 404 });
  }

  // ── Phase 3: Pseudonym and avatar color generation ────────────────────────
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

  try {
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, userData);
    return NextResponse.json(authResponse);
  } catch (err) {
    console.error('[POST /api/v1/collab/auth]', err);
    return NextResponse.json({ error: 'Channel auth failed' }, { status: 500 });
  }
}
