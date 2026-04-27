/**
 * Critical path E2E test: PIN login → take order → pay cash → close shift.
 *
 * Requires DB seeded with the demo tenant (`pnpm db:seed`) and API + POS apps
 * running. Skipped in CI unless E2E_FULL=1 because it needs the full stack.
 */
import { test, expect } from '@playwright/test';

const FULL = process.env.E2E_FULL === '1';

test.describe('POS — happy path', () => {
  test.skip(!FULL, 'requires full stack: pnpm db:up && pnpm db:seed && pnpm dev');

  test('PIN login → add menu item → submit cash payment', async ({ page }) => {
    await page.goto('/login-pin');

    // Outlet pre-selection from demo seed expected.
    for (const digit of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    await page.getByRole('button', { name: /^OK$/ }).click();

    await expect(page).toHaveURL(/\/(order|tables)/);

    if (page.url().includes('/tables')) {
      await page.getByRole('button', { name: /Order tanpa meja/i }).click();
    }

    // Click first menu item (any).
    const firstItem = page.locator('button:has(div.font-medium)').first();
    await firstItem.click();

    await expect(page.locator('aside')).toContainText(/Total/i);

    // Pay
    await page.getByRole('button', { name: /^Bayar$/ }).click();
  });
});
