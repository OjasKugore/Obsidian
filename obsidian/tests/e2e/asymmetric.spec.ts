import { test, expect } from '@playwright/test';

test.describe('Asymmetric RSA-OAEP Key Wrapping Flow', () => {
  test('generates identity key, encrypts with recipient public key, and unlocks with private key', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // 2. Open Identity Panel from header
    const idBtn = page.locator('#identity-panel-btn');
    await idBtn.click();

    // 3. Generate RSA Identity Key if not already present
    const generateBtn = page.locator('#generate-identity-key-btn');
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await expect(page.getByText('Identity Key Active')).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page.getByText('Identity Key Active')).toBeVisible({ timeout: 5000 });
    }

    // 4. Close identity modal
    const closeBtn = page.locator('#close-identity-modal-btn');
    await closeBtn.click();
    await expect(page.locator('#close-identity-modal-btn')).not.toBeVisible();

    // 5. Enter secret message
    const secretContent = `CONFIDENTIAL ASYMMETRIC MESSAGE - ${Date.now()}`;
    const textarea = page.locator('textarea').first();
    await textarea.fill(secretContent);

    // 6. Select RSA-OAEP Public Key delivery mode
    const asymPill = page.getByText('RSA-OAEP Public Key');
    await asymPill.click();

    // 7. Click "Use my key" button in RecipientKeyInput
    const useMyKeyBtn = page.getByText('Use my key');
    await expect(useMyKeyBtn).toBeVisible();
    await useMyKeyBtn.click();

    // 8. Verify Public Key is validated
    await expect(page.getByText('Valid RSA-2048 Public Key')).toBeVisible({ timeout: 10000 });

    // 9. Select unlimited view mode to allow verification
    const destroySelect = page.locator('select').nth(1);
    await destroySelect.selectOption('unlimited');

    // 10. Submit creation
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 11. Verify SharePanel indicates recipient encryption and #asym URL
    await expect(page.getByText('Recipient Encrypted Paste Created')).toBeVisible({ timeout: 10000 });
    const shareInput = page.locator('input[readonly]').first();
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toContain('#asym');

    // 12. Navigate to #asym URL
    await page.goto(shareUrl);

    // 13. If manual unlock button is shown, click it (otherwise it auto-unlocks from keystore)
    const unlockBtn = page.locator('#unlock-with-identity-key-btn');
    if (await unlockBtn.isVisible()) {
      await unlockBtn.click();
    }

    // 14. Verify decrypted plaintext is displayed
    await expect(page.getByText('Decrypted: plaintext')).toBeVisible({ timeout: 10000 });
    const decryptedPre = page.locator('pre');
    await expect(decryptedPre).toHaveText(secretContent);
  });
});
