import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

/**
 * W7 — modal de detalle sobre el grid. Necesita el backend real levantado
 * con catálogo publicado (`shop-backend-service`, `docker compose up`):
 * sin productos reales en el grid no hay tarjeta que abrir.
 */
test.describe('modal de detalle', () => {
  test('caso 33: atrás cierra el modal y devuelve al grid en la misma posición de scroll', async ({ page }) => {
    await page.goto('/');

    const firstProductLink = page.getByRole('main').getByRole('link').first();
    await firstProductLink.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/\/p\//);

    const scrollYWithModalOpen = await page.evaluate(() => window.scrollY);

    await page.goBack();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveURL('/');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollYWithModalOpen);
  });

  test('abrir el modal y recargar la página muestra la vista completa de W6', async ({ page }) => {
    await page.goto('/');

    const firstProductLink = page.getByRole('main').getByRole('link').first();
    await firstProductLink.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.reload();

    await expect(page.getByRole('dialog')).toBeHidden();
    // La ruta completa de W6 no tiene la lista del catálogo detrás.
    await expect(page.getByRole('list')).toHaveCount(0);
    await expect(page).toHaveURL(/\/p\//);
  });

  test('axe sin infracciones con el modal abierto', async ({ page }) => {
    await page.goto('/');

    const firstProductLink = page.getByRole('main').getByRole('link').first();
    await firstProductLink.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
