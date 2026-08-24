/**
 * tests/unit/receipt.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for Cryptographic Proof of Destruction (Burn Receipts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { createBurnReceipt, verifyBurnReceipt } from '@/lib/crypto/receipt';

describe('Cryptographic Burn Receipts', () => {
  it('generates a valid signed burn receipt for burn-after-reading', async () => {
    const pasteId = 'a1b2c3d4e5f67890';
    const receipt = await createBurnReceipt(pasteId, 'BURN_AFTER_READING', 1);

    expect(receipt.receiptId).toMatch(/^rcpt_/);
    expect(receipt.pasteId).toBe(pasteId);
    expect(receipt.reason).toBe('BURN_AFTER_READING');
    expect(receipt.viewsServed).toBe(1);
    expect(receipt.algorithm).toBe('HMAC-SHA256');
    expect(receipt.signature).toBeDefined();
    expect(receipt.signature.length).toBe(64); // 32-byte SHA-256 hex string

    const isValid = await verifyBurnReceipt(receipt);
    expect(isValid).toBe(true);
  });

  it('generates a valid signed burn receipt for MAX_VIEWS_REACHED', async () => {
    const pasteId = 'f0e1d2c3b4a56789';
    const receipt = await createBurnReceipt(pasteId, 'MAX_VIEWS_REACHED', 5);

    expect(receipt.reason).toBe('MAX_VIEWS_REACHED');
    expect(receipt.viewsServed).toBe(5);

    const isValid = await verifyBurnReceipt(receipt);
    expect(isValid).toBe(true);
  });

  it('rejects a receipt with tampered signature or timestamp', async () => {
    const pasteId = '1234567890abcdef';
    const receipt = await createBurnReceipt(pasteId, 'BURN_AFTER_READING', 1);

    // Tamper with destroyed timestamp
    const tamperedReceipt = {
      ...receipt,
      destroyedAt: '2020-01-01T00:00:00.000Z',
    };

    const isValid = await verifyBurnReceipt(tamperedReceipt);
    expect(isValid).toBe(false);
  });
});
