/**
 * app/api/v1/receipt/[id]/route.ts
 * GET /api/v1/receipt/[id] — Verify cryptographic proof of destruction
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates a burn receipt object passed via query/body or verifies
 * cryptographic proof that a paste ID hash was irrevocably purged from the DB.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyBurnReceipt } from '@/lib/crypto/receipt';
import type { BurnReceipt } from '@/lib/crypto/receipt';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const body = (await request.json()) as { receipt: BurnReceipt };
    if (!body || !body.receipt) {
      return NextResponse.json(
        { error: 'Receipt payload required' },
        { status: 400 }
      );
    }

    const receipt = body.receipt;
    const isValid = await verifyBurnReceipt(receipt);

    // Verify the paste actually does NOT exist in the database anymore (Proof of Absence)
    const existsInDb = await prisma.paste.findUnique({
      where: { id: receipt.pasteId || id },
      select: { id: true },
    });

    return NextResponse.json({
      verified: isValid,
      proofOfAbsence: !existsInDb,
      receiptDetails: {
        receiptId: receipt.receiptId,
        pasteIdHash: receipt.pasteIdHash,
        destroyedAt: receipt.destroyedAt,
        reason: receipt.reason,
        viewsServed: receipt.viewsServed,
        algorithm: receipt.algorithm,
      },
      message:
        isValid && !existsInDb
          ? 'Cryptographic burn receipt signature is VALID and paste record is permanently absent from database.'
          : 'Receipt verification failed or record still exists.',
    });
  } catch (err) {
    console.error('[POST /api/v1/receipt/[id]]', err);
    return NextResponse.json({ error: 'Failed to verify receipt' }, { status: 500 });
  }
}
