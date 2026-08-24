import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cron/cleanup
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled cron job endpoint (invoked via Vercel Cron).
 * Sweeps and deletes all expired pastes and orphaned records.
 *
 * Security:
 * - When CRON_SECRET is configured, requests must supply:
 *   Authorization: Bearer <CRON_SECRET>
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized cron request' },
        { status: 401 }
      );
    }

    const now = new Date();

    // 1. Delete all pastes whose expiration timestamp is past
    const deletedPastes = await prisma.paste.deleteMany({
      where: {
        expiresAt: {
          not: null,
          lt: now,
        },
      },
    });

    return NextResponse.json({
      status: 'ok',
      timestamp: now.toISOString(),
      deletedCount: deletedPastes.count,
    });
  } catch (error) {
    console.error('Error during expired paste cleanup cron:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during cleanup' },
      { status: 500 }
    );
  }
}
