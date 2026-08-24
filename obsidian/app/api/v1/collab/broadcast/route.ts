import { NextRequest, NextResponse } from 'next/server';
import { pusher } from '@/lib/pusher';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await checkRateLimit(request);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: { channel?: string; event?: string; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { channel, event, data } = body;

  if (!channel || !event || !data) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Only allow presence-collab channels
  if (!channel.startsWith('presence-collab-')) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
  }

  try {
    await pusher.trigger(channel, event, data);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[POST /api/v1/collab/broadcast]', err);
    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 });
  }
}
