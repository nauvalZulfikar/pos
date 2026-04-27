import { test, expect } from '@playwright/test';

const DEMO_OUTLET = '00000000-0000-7000-8000-000000000002';

test.describe('POS terminal — smoke', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    // Wipe storage BEFORE any script runs on first navigation.
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignored */
      }
    });
  });

  test('unpaired terminal lands on outlet pairing form', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login-pin/);
    await expect(page.getByText(/Pasangkan terminal/i)).toBeVisible();
  });

  test('pairing via ?outlet= URL skips the manual form and shows PIN keypad', async ({ page }) => {
    await page.goto(`/login-pin?outlet=${DEMO_OUTLET}`);
    await expect(page.getByText(/Masukkan PIN/i)).toBeVisible();
    for (const digit of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    const filled = page.locator('div').filter({ hasText: /^•$/ });
    await expect(filled).toHaveCount(4);
  });

  test('manual outlet form rejects invalid UUID', async ({ page }) => {
    await page.goto('/login-pin');
    await expect(page.getByText(/Pasangkan terminal/i)).toBeVisible();
    await page.getByPlaceholder(/00000000/).fill('not-a-uuid');
    await page.getByRole('button', { name: /Pasang ke cabang/i }).click();
    await expect(page.getByText(/UUID outlet tidak valid/i)).toBeVisible();
  });
});
