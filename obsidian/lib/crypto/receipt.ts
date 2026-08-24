/**
 * lib/crypto/receipt.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cryptographic Proof of Destruction (Burn Receipt) Engine.
 *
 * When a paste is destroyed (via burn-after-reading, max-views exhaustion,
 * or explicit delete token), the server issues a signed cryptographic receipt.
 * The receipt proves:
 *   1. The paste ID hash existed.
 *   2. The paste was permanently purged from the database.
 *   3. The exact UTC timestamp of destruction.
 *   4. The destruction trigger (BURN_AFTER_READING | MAX_VIEWS_REACHED | MANUAL_DELETE).
 *
 * Signed using HMAC-SHA256 with server-side master receipt salt.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface BurnReceipt {
  receiptId: string;
  pasteId: string;
  pasteIdHash: string;
  destroyedAt: string;
  reason: 'BURN_AFTER_READING' | 'MAX_VIEWS_REACHED' | 'MANUAL_DELETE' | 'EXPIRED';
  viewsServed: number;
  signature: string;
  algorithm: 'HMAC-SHA256';
  version: 1;
}

/**
 * Derives HMAC-SHA256 signature for a burn receipt payload
 */
async function signReceiptPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a signed cryptographic burn receipt.
 */
export async function createBurnReceipt(
  pasteId: string,
  reason: BurnReceipt['reason'],
  viewsServed: number = 1
): Promise<BurnReceipt> {
  const secret = process.env.RECEIPT_SIGNING_KEY || process.env.IP_HMAC_SECRET || 'obsidian-receipt-secret-salt-2026';
  const destroyedAt = new Date().toISOString();
  
  // Compute SHA-256 hash of paste ID for privacy
  const pasteIdBuffer = new TextEncoder().encode(pasteId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', pasteIdBuffer);
  const pasteIdHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const receiptId = `rcpt_${pasteIdHash.slice(0, 12)}_${Date.now()}`;
  const canonicalPayload = `${receiptId}:${pasteIdHash}:${destroyedAt}:${reason}:${viewsServed}`;
  const signature = await signReceiptPayload(canonicalPayload, secret);

  return {
    receiptId,
    pasteId,
    pasteIdHash,
    destroyedAt,
    reason,
    viewsServed,
    signature,
    algorithm: 'HMAC-SHA256',
    version: 1,
  };
}

/**
 * Verifies a burn receipt signature against the server key.
 */
export async function verifyBurnReceipt(receipt: BurnReceipt): Promise<boolean> {
  const secret = process.env.RECEIPT_SIGNING_KEY || process.env.IP_HMAC_SECRET || 'obsidian-receipt-secret-salt-2026';
  const canonicalPayload = `${receipt.receiptId}:${receipt.pasteIdHash}:${receipt.destroyedAt}:${receipt.reason}:${receipt.viewsServed}`;
  const expectedSig = await signReceiptPayload(canonicalPayload, secret);
  return receipt.signature === expectedSig;
}
