import { test, expect } from '@playwright/test';

test.describe('Shamir Secret Sharing (SSS) Quorum Flow', () => {
  test('creates a 2-of-3 Shamir paste, combines 2 shards in browser, and successfully decrypts', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // 2. Type secret content
    const secretContent = `TOP SECRET SHAMIR QUORUM DATA - ${Date.now()}`;
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill(secretContent);

    // 3. Switch to Multiple delivery mode (Shamir SSS)
    const multiModeBtn = page.getByRole('button', { name: 'Multiple' });
    await multiModeBtn.click();

    // 4. Submit paste creation
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Verify Shard links appear in SharePanel
    await expect(page.getByText('Threshold Shards Created')).toBeVisible({ timeout: 10000 });
    const shardInputs = page.locator('input[readonly]');
    await expect(shardInputs.first()).toBeVisible();

    const shard1Url = await shardInputs.nth(0).inputValue();
    const shard2Url = await shardInputs.nth(1).inputValue();

    expect(shard1Url).toContain('#shard-');
    expect(shard2Url).toContain('#shard-');

    // 6. Navigate to Shard #1 URL
    await page.goto(shard1Url);

    // 7. Verify Shard Quorum collection panel is displayed
    await expect(page.getByText('Shamir Quorum Required')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Collected Shards: 1 of 2 required')).toBeVisible();

    // 8. Provide Shard #2 (extract token after '#')
    const shard2Token = shard2Url.split('#')[1];
    const tokenInput = page.locator('#shard-token-input');
    await tokenInput.fill(shard2Token);

    const addShardBtn = page.getByRole('button', { name: 'Add Shard' });
    await addShardBtn.click();

    // 9. Verify secret is reconstructed and decrypted
    await expect(page.getByText('Decrypted: plaintext')).toBeVisible({ timeout: 10000 });
    const decryptedPre = page.locator('pre');
    await expect(decryptedPre).toHaveText(secretContent);
  });
});
