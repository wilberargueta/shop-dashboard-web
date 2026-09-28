import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

/**
 * Caso 50 de PROJECT_SPEC.md §15: axe sin infracciones en las tres vistas
 * principales. El modal abierto ya está cubierto en
 * `e2e/product-modal.spec.ts` (W7) — aquí van las otras dos. Necesita el
 * backend real levantado con catálogo publicado, igual que el resto de los
 * e2e del repo.
 */
test.describe('accesibilidad (axe)', () => {
  test('caso 50: / sin infracciones', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main').getByRole('link').first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('caso 50: /p/:slug sin infracciones', async ({ page }) => {
    await page.goto('/');
    const firstProductLink = page.getByRole('main').getByRole('link').first();
    const href = await firstProductLink.getAttribute('href');
    if (!href) {
      throw new Error('El grid no tiene ningún producto para navegar a su detalle.');
    }

    await page.goto(href);
    await expect(page.getByRole('main')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
