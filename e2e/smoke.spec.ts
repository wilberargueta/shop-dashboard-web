import { test, expect } from '@playwright/test';

test('la página inicial carga y sirve HTML renderizado en servidor', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Catálogo/);
});
