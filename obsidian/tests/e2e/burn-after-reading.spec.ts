import { test, expect } from '@playwright/test';

test.describe('Burn After Reading Flow', () => {
  test('creates a burn-after-reading paste, decrypts on first view, and shows 404 on second view', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // 2. Type secret content into editor
    const secretContent = `SELF DESTRUCTING NOTE: ${Date.now()}`;
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill(secretContent);

    // Default mode is Burn After Reading (1 view)
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 3. Obtain share URL
    await expect(page.getByText('Encrypted Paste Ready')).toBeVisible({ timeout: 10000 });
    const shareInput = page.locator('input[readonly]').first();
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toContain('#');

    // 4. First view: Opens and decrypts successfully with burned banner
    await page.goto(shareUrl);
    await expect(page.getByText(/Burned After Reading/i)).toBeVisible({ timeout: 10000 });
    const decryptedPre = page.locator('pre');
    await expect(decryptedPre).toHaveText(secretContent);

    // 5. Second view: Reloading or re-visiting should return destroyed/unavailable state
    await page.reload();
    await expect(
      page.getByText(/Secret Destroyed or Unavailable/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
