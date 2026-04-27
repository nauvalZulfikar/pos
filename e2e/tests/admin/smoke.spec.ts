import { test, expect } from '@playwright/test';

test.describe('Admin dashboard — smoke', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /DESAIN POS Admin/i })).toBeVisible();
  });

  test('login form renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Masuk/i })).toBeVisible();
  });
});
