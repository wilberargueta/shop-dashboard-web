import type { PageResponseProductCard } from '../../app/api/model/page-response-product-card';

/** Tamaño máximo de página documentado (ARQUITECTURA.md §5.1: `size` 1..48). */
const PAGE_SIZE = 48;

/**
 * Se usa `fetch` directo contra `API_BASE_URL`, sin pasar por el cliente
 * generado (`src/app/api/`): esta función corre fuera del árbol de Angular
 * (una ruta de Express registrada en `server.ts`, cacheada una hora), y
 * bootstrapear una plataforma Angular completa por cada regeneración del
 * sitemap sería desproporcionado para algo tan puntual. Solo se importa el
 * *tipo* `PageResponseProductCard` del cliente generado, nunca su código —
 * no es "editar" `src/app/api/`, que sigue intacto.
 *
 * El header `Accept: application/json` explícito es obligatorio: el OpenAPI
 * del backend no declara `produces` (hallazgo de W1), y sin negociar el
 * content-type explícitamente la respuesta puede no llegar como JSON.
 */
export async function fetchPublishedProductSlugs(apiBaseUrl: string): Promise<string[]> {
  const slugs: string[] = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const response = await fetch(`${apiBaseUrl}/api/public/v1/products?page=${page}&size=${PAGE_SIZE}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`GET /api/public/v1/products?page=${page} -> HTTP ${response.status}`);
    }

    const body = (await response.json()) as PageResponseProductCard;
    for (const item of body.content ?? []) {
      if (item.slug) {
        slugs.push(item.slug);
      }
    }
    hasNext = body.hasNext ?? false;
    page += 1;
  }

  return slugs;
}
