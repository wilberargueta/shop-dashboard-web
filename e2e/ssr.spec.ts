import { test, expect } from '@playwright/test';

/**
 * Caso 44 de PROJECT_SPEC.md §15, trasladado desde W4 y cerrado en W14: el
 * primer lote de `/` (productos y categorías) no se pide dos veces —
 * servidor y navegador comparten la respuesta vía `cacheFirstValue`
 * (`core/http/transfer-state-cache.ts`), sin depender de `HttpTransferCache`
 * (su clave es la URL completa, absoluta en servidor y relativa en
 * navegador — nunca coincide).
 */
test('caso 44: el primer lote no se pide dos veces (servidor + hidratación)', async ({ page }) => {
  const apiRequestsFromBrowser: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/public/v1/')) {
      apiRequestsFromBrowser.push(request.url());
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main').getByRole('link').first()).toBeVisible();

  expect(apiRequestsFromBrowser).toEqual([]);
});
