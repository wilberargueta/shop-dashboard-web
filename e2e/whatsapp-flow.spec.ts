import { Page, test, expect } from '@playwright/test';

/**
 * Casos 47 y 48 de PROJECT_SPEC.md §15: el flujo completo (entrar → filtrar
 * por categoría → buscar → abrir un producto → ver las fotos → seleccionar
 * 2 productos → vista previa → comprobar la URL de WhatsApp) una vez con
 * ratón y otra solo con teclado.
 *
 * Contra el backend real (`shop-backend-service`), con los datos semilla
 * reales: categoría "Aceites" (3 productos: lavanda, árbol de té,
 * eucalipto) y "Cremas" (2 productos). Buscar "lavanda" dentro de "Aceites"
 * acota siempre a un solo producto real.
 *
 * Única excepción, y solo para el detalle de ese producto: los datos
 * semilla no tienen ningún producto con más de una imagen (verificado
 * contra los 11 productos reales), así que "ver las fotos" no se puede
 * ejercitar de verdad — se intercepta solo esa petición
 * (`/products/aceite-esencial-de-lavanda-30ml`) con una copia de la
 * respuesta real que añade una segunda imagen. Mismo criterio que el caso
 * 56 de W13: mockear lo mínimo indispensable cuando el dato real no puede
 * garantizarlo, nunca el resto del flujo.
 */

const LAVANDA_SLUG = 'aceite-esencial-de-lavanda-30ml';
const LAVANDA_NAME = 'Aceite esencial de lavanda 30ml';
const CREMA_NAME = 'Crema hidratante de karite 200ml';

declare global {
  interface Window {
    __openedUrls?: string[];
  }
}

/**
 * Intercepta `window.open` de verdad (caso 47/48 lo piden explícitamente),
 * sin dejar que el navegador navegue a la URL real de WhatsApp — `wa.me`
 * redirige de verdad a `api.whatsapp.com` cuando hay salida a internet, y
 * ese salto es infraestructura de WhatsApp, no algo que este repo controle
 * ni deba depender de la red para pasar el test.
 */
async function interceptWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__openedUrls = [];
    window.open = (url?: string | URL) => {
      window.__openedUrls!.push(String(url ?? ''));
      return null;
    };
  });
}

async function lastOpenedUrl(page: Page): Promise<string> {
  return page.evaluate(() => window.__openedUrls?.at(-1) ?? '');
}

async function mockLavandaWithTwoImages(page: Page): Promise<void> {
  await page.route(`**/api/public/v1/products/${LAVANDA_SLUG}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.images = [...(body.images ?? []), ...(body.images ?? [])];
    route.fulfill({ response, json: body });
  });
}

/** Decodifica el `text` de una URL `https://wa.me/{numero}?text=...` para comprobar su contenido. */
function decodeWhatsAppText(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('text') ?? '');
}

test.describe('flujo completo de selección y envío por WhatsApp', () => {
  test('caso 47: filtrar, buscar, abrir un producto, seleccionar 2 y comprobar la URL de wa.me', async ({ page }) => {
    await interceptWindowOpen(page);
    await page.goto('/');
    await expect(page.getByRole('main').getByRole('link', { name: LAVANDA_NAME })).toBeVisible();

    // Filtrar por categoría: "Aceites" tiene 3 productos en los datos semilla.
    await page.getByRole('checkbox', { name: /^Aceites \(\d+\)$/ }).check();
    await expect(page.getByRole('main').getByRole('link')).toHaveCount(3);

    // Buscar: acota a un solo producto dentro de la categoría ya filtrada.
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('lavanda');
    await page.waitForTimeout(400); // debounce de 300ms (caso 22)
    await expect(page.getByRole('main').getByRole('link')).toHaveCount(1);

    // Abrir el producto y ver las fotos.
    await mockLavandaWithTwoImages(page);
    await page.getByRole('main').getByRole('link', { name: LAVANDA_NAME }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const liveAnnouncement = dialog.locator('[aria-live="polite"]');
    await expect(liveAnnouncement).toHaveText('Imagen 1 de 2');
    await dialog.getByRole('button', { name: 'Siguiente imagen' }).click();
    await expect(liveAnnouncement).toHaveText('Imagen 2 de 2');
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialog).toBeHidden();
    // Cerrar dispara `location.back()` (W7) de forma asíncrona: hay que
    // esperar a que la URL se asiente (sigue en "/" con los filtros
    // aplicados) antes de disparar otra navegación (Limpiar filtros), o las
    // dos compiten entre sí.
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');

    // Limpiar filtros para volver a ver todo el catálogo y seleccionar 2 productos.
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
    await expect(page.getByRole('main').getByRole('link', { name: LAVANDA_NAME })).toBeVisible();
    await page.getByRole('checkbox', { name: `Seleccionar ${LAVANDA_NAME}` }).click();
    await page.getByRole('checkbox', { name: `Seleccionar ${CREMA_NAME}` }).click();

    // Vista previa y envío.
    await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
    const previewDialog = page.getByRole('dialog', { name: 'Vista previa del mensaje' });
    await expect(previewDialog).toBeVisible();
    await previewDialog.getByRole('button', { name: 'Enviar', exact: true }).click();

    const url = await lastOpenedUrl(page);
    expect(url).toMatch(/^https:\/\/wa\.me\/50370000000\?text=/);
    const text = decodeWhatsAppText(url);
    expect(text).toContain(LAVANDA_NAME);
    expect(text).toContain(CREMA_NAME);
  });

  test('caso 48: el mismo flujo operado solo con teclado', async ({ page }) => {
    await interceptWindowOpen(page);
    await page.goto('/');
    await expect(page.getByRole('main').getByRole('link', { name: LAVANDA_NAME })).toBeVisible();

    // Filtrar por categoría con Espacio, buscar con el teclado.
    const categoryCheckbox = page.getByRole('checkbox', { name: /^Aceites \(\d+\)$/ });
    await categoryCheckbox.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('main').getByRole('link')).toHaveCount(3);

    const searchBox = page.getByRole('searchbox', { name: 'Buscar' });
    await searchBox.focus();
    await page.keyboard.type('lavanda');
    await page.waitForTimeout(400);
    await expect(page.getByRole('main').getByRole('link')).toHaveCount(1);

    // Abrir el producto con Enter.
    await mockLavandaWithTwoImages(page);
    const productLink = page.getByRole('main').getByRole('link', { name: LAVANDA_NAME });
    await productLink.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // El carrusel se navega con las flechas del teclado (W6): basta con
    // llevar el foco a uno de sus controles, ya dentro del `role="group"`
    // que escucha `keydown` — replicar el recorrido completo de `Tab` desde
    // el primer elemento enfocado del diálogo sería frágil ante cualquier
    // cambio de marcado sin aportar más cobertura real.
    await dialog.getByRole('button', { name: 'Siguiente imagen' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('[aria-live="polite"]')).toHaveText('Imagen 2 de 2');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');

    await page.getByRole('button', { name: /Limpiar filtros/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main').getByRole('link', { name: LAVANDA_NAME })).toBeVisible();

    await page.getByRole('checkbox', { name: `Seleccionar ${LAVANDA_NAME}` }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('checkbox', { name: `Seleccionar ${CREMA_NAME}` }).focus();
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Enviar por WhatsApp' }).focus();
    await page.keyboard.press('Enter');
    const previewDialog = page.getByRole('dialog', { name: 'Vista previa del mensaje' });
    await expect(previewDialog).toBeVisible();

    await previewDialog.getByRole('button', { name: 'Enviar', exact: true }).focus();
    await page.keyboard.press('Enter');

    const url = await lastOpenedUrl(page);
    expect(url).toMatch(/^https:\/\/wa\.me\/50370000000\?text=/);
  });
});
