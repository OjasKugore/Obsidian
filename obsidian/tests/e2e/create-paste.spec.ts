import { test, expect } from '@playwright/test';

test.describe('Symmetric Paste Flow', () => {
  test('creates an encrypted paste, navigates to #fragment URL, and decrypts', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // 2. Type secret content into editor
    const secretText = `TOP SECRET PAYLOAD - ${Date.now()}\nLine 2: Confidential cryptographic secret.`;
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill(secretText);

    // 3. Select unlimited views or standard expiry to test normal symmetric view
    const destroySelect = page.locator('select').nth(1); // Destruction Trigger dropdown
    await destroySelect.selectOption('unlimited');

    // 4. Click Submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Verify SharePanel appears
    await expect(page.getByText('Encrypted Paste Ready')).toBeVisible({ timeout: 10000 });
    const shareInput = page.locator('input[readonly]').first();
    await expect(shareInput).toBeVisible();
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toContain('#');

    // 6. Navigate directly to the encrypted share URL
    await page.goto(shareUrl);

    // 7. Verify decryption occurs in-browser and plaintext matches
    await expect(page.getByText('Decrypted: plaintext')).toBeVisible({ timeout: 10000 });
    const decryptedPre = page.locator('pre');
    await expect(decryptedPre).toBeVisible();
    await expect(decryptedPre).toHaveText(secretText);
  });
});
