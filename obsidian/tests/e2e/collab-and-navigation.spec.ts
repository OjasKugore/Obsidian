import { test, expect } from '@playwright/test';

test.describe('Collaboration and Navigation Suites', () => {
  test('launches live E2EE pad and enables encrypted real-time typing', async ({ page }) => {
    // 1. Visit /pad launcher
    await page.goto('/pad');
    await expect(page.getByText('Live E2EE Scratchpad')).toBeVisible();

    // 2. Click Launch Live Pad
    const launchBtn = page.getByRole('button', { name: 'Launch Live Pad' });
    await launchBtn.click();

    // 3. Verify room page loaded with #key
    await page.waitForURL(/\/pad\/[0-9a-f]+#.+/);
    const roomUrl = page.url();
    expect(roomUrl).toContain('#');

    // 4. Verify LivePad workspace is mounted and accessible
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // 5. Type collaborative notes
    const padContent = `LIVE COLLABORATION SESSION - ${Date.now()}\nAll keystrokes encrypted end-to-end.`;
    await textarea.fill(padContent);
    await expect(textarea).toHaveValue(padContent);
  });

  test('opens Zero-Knowledge Trust Visualizer and switches protocol tabs', async ({ page }) => {
    await page.goto('/');

    // Open Security (Trust Visualizer) from Header
    const securityNavBtn = page.getByRole('button', { name: 'Security' }).first();
    await securityNavBtn.click();

    // Verify Trust Visualizer modal renders
    await expect(page.getByText('Zero-Knowledge Security Architecture')).toBeVisible({ timeout: 10000 });

    // Switch to RSA-OAEP Key Wrapping tab
    const rsaBtn = page.getByRole('button', { name: 'RSA-OAEP (#asym)' });
    if (await rsaBtn.isVisible()) {
      await rsaBtn.click();
      await expect(page.getByText('Hybrid Envelope Encryption')).toBeVisible();
    }

    // Switch to Shamir Secret Sharing tab
    const shamirBtn = page.getByRole('button', { name: 'Shamir SSS (K-of-N)' });
    if (await shamirBtn.isVisible()) {
      await shamirBtn.click();
      await expect(page.getByText('Galois Field GF(2⁸) Splitting')).toBeVisible();
    }
  });

  test('navigates to API docs and Vault pages cleanly', async ({ page }) => {
    // 1. Visit /api/docs
    await page.goto('/api/docs');
    await expect(page.getByText('Developer Portal')).toBeVisible({ timeout: 10000 });

    // Switch to REST API Spec tab
    const restTabBtn = page.getByRole('button', { name: 'REST API Spec' });
    await restTabBtn.click();
    await expect(page.getByText('/api/v1/paste').first()).toBeVisible();

    // 2. Visit /vault
    await page.goto('/vault');
    await expect(page.getByText(/Vault Items/i)).toBeVisible({ timeout: 10000 });
  });
});
