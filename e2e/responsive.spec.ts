import { Page, test, expect } from '@playwright/test';
import { DESKTOP_BREAKPOINT, MOBILE_LANDSCAPE, RESPONSIVE_WIDTHS } from './utils/viewports';

/**
 * W13 — diseño responsive. Necesita el backend real levantado con catálogo
 * publicado (`shop-backend-service`, `docker compose up`), salvo el caso 56
 * (ver más abajo, mockeado a propósito). Casos 51-58 de PROJECT_SPEC.md §15.
 */

async function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

function buildProductsResponse(products: Record<string, unknown>[]) {
  return {
    content: products,
    page: 0,
    size: products.length,
    totalElements: products.length,
    totalPages: 1,
    hasNext: false,
  };
}

test.describe('caso 51: sin scroll horizontal en ningún ancho de verificación', () => {
  for (const width of RESPONSIVE_WIDTHS) {
    test(`a ${width}px, en / y con el modal de detalle abierto`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      expect(await hasNoHorizontalScroll(page)).toBe(true);

      const firstProductLink = page.getByRole('main').getByRole('link').first();
      await firstProductLink.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await hasNoHorizontalScroll(page)).toBe(true);
      await page.goBack();

      if (width < DESKTOP_BREAKPOINT) {
        await page.getByRole('button', { name: 'Filtros' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(await hasNoHorizontalScroll(page)).toBe(true);
      }
    });
  }
});

test.describe('caso 52: columnas del grid según el ancho', () => {
  const cases: Array<{ width: number; columns: number }> = [
    { width: 375, columns: 1 },
    { width: 768, columns: 2 },
    { width: 1280, columns: 3 },
  ];

  for (const { width, columns } of cases) {
    test(`${columns} columna(s) a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const grid = page.getByRole('list');
      await expect(grid).toBeVisible();
      const trackCount = await grid.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length,
      );
      expect(trackCount).toBe(columns);
    });
  }
});

test.describe('caso 53: el detalle es pantalla completa en móvil y modal centrado en escritorio', () => {
  test('a 375px el panel ocupa toda la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await page.getByRole('main').getByRole('link').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThanOrEqual(1);
    expect(box!.y).toBeLessThanOrEqual(1);
    expect(box!.width).toBeGreaterThanOrEqual(374);
    expect(box!.height).toBeGreaterThanOrEqual(799);
  });

  test('a 1280px el panel queda centrado, con el grid visible detrás', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.getByRole('main').getByRole('link').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    // Modal centrado: deja margen visible a los lados, nunca pegado al borde.
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.width).toBeLessThan(1280);
    // El grid sigue montado (con `inert`, no oculto) detrás del backdrop.
    await expect(page.getByRole('list')).toHaveCount(1);
  });
});

test.describe('caso 54: la barra de selección no tapa el último producto', () => {
  for (const width of [375, 1280]) {
    test(`a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();
      const bar = page.getByRole('region', { name: 'Selección de productos' });

      const lastCard = page.locator('.product-card').last();
      await lastCard.scrollIntoViewIfNeeded();

      const cardBox = await lastCard.boundingBox();
      const barBox = await bar.boundingBox().catch(() => null);
      expect(cardBox).not.toBeNull();

      if (barBox) {
        expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(barBox.y + 1);
      }

      // El centro de la tarjeta responde a un clic real (no queda tapado por la barra).
      const centerX = cardBox!.x + cardBox!.width / 2;
      const centerY = cardBox!.y + cardBox!.height - 4;
      const elementAtPoint = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.closest('.product-card') !== null,
        [centerX, centerY],
      );
      expect(elementAtPoint).toBe(true);
    });
  }
});

test.describe('caso 55: áreas táctiles de 44×44 px a 375px', () => {
  test('todos los controles interactivos visibles cumplen el mínimo', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');

    // Los checkboxes nativos (filtros) miden 20×20: el objetivo táctil real
    // es el <label> que los envuelve (fila completa, min-height 44px).
    const controls = page.locator(
      'button:visible, a[href]:visible, select:visible, label:has(input[type="checkbox"]):visible',
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      if (!box) {
        continue;
      }
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('caso 56: un nombre de 120 caracteres sin espacios no desborda la tarjeta', () => {
  test('a 320px', async ({ page }) => {
    // Desviación deliberada del patrón "siempre contra el backend real" de
    // este repo: es una aserción puramente de CSS/renderizado, y los datos
    // semilla no garantizan un nombre así de largo. Se mockean products y
    // categories para no depender de eso.
    const longName = 'A'.repeat(120);
    await page.route('**/api/public/v1/products*', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          buildProductsResponse([
            {
              id: 'p-long-name',
              name: longName,
              slug: 'p-long-name',
              price: 10,
              effectivePrice: 10,
              onSale: false,
              currency: 'USD',
              inStock: true,
            },
          ]),
        ),
      }),
    );
    await page.route('**/api/public/v1/categories*', (route) =>
      route.fulfill({ contentType: 'application/json', body: '[]' }),
    );

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');

    const name = page.locator('.product-card__name');
    await expect(name).toBeVisible();
    await expect(name).toHaveText(longName);
    expect(await hasNoHorizontalScroll(page)).toBe(true);

    const overflowsCard = await page.locator('.product-card').evaluate(
      (card) => card.scrollWidth > card.clientWidth,
    );
    expect(overflowsCard).toBe(false);
  });
});

test.describe('caso 57: usable con zoom del navegador al 200% a 1280px', () => {
  test('sin scroll horizontal', async ({ page }) => {
    // El zoom del navegador reduce a la mitad el viewport CSS efectivo:
    // 1280px al 200% se comporta, a efectos de layout, como 640px.
    await page.setViewportSize({ width: 640, height: 720 });
    await page.goto('/');
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await expect(page.getByRole('list')).toBeVisible();
  });
});

test.describe('caso 58: móvil horizontal, el botón de WhatsApp es alcanzable', () => {
  test(`en ${MOBILE_LANDSCAPE.width}x${MOBILE_LANDSCAPE.height}`, async ({ page }) => {
    await page.setViewportSize(MOBILE_LANDSCAPE);
    await page.goto('/');
    await page.getByRole('main').getByRole('link').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const whatsappButton = page.getByRole('dialog').locator('.product-detail-content__whatsapp-button');
    await whatsappButton.scrollIntoViewIfNeeded();
    await expect(whatsappButton).toBeInViewport();
  });
});
