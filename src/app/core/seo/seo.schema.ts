import type { ImageDetailRef } from '../../api/model/image-detail-ref';
import type { ProductCard } from '../../api/model/product-card';
import type { ProductDetail } from '../../api/model/product-detail';

/**
 * Misma preferencia webp-luego-jpeg que `product-detail-page.ts` ya usaba
 * para `og:image` (W6): se extrae aquí para no duplicarla también en el
 * JSON-LD de `Product`.
 */
export function resolveAbsoluteDetailImage(
  siteUrl: string,
  images: readonly ImageDetailRef[] | undefined,
): string | undefined {
  const rendition = images?.[0]?.detail;
  const path = rendition?.webp ?? rendition?.jpeg;
  return path ? `${siteUrl}${path}` : undefined;
}

/**
 * `brand.name` reutiliza el nombre de la tienda: el modelo público no expone
 * una marca por producto, y esta tienda no tiene varias marcas propias.
 * `image` se omite sin ninguna disponible, igual que `og:image` (sin
 * `settings.seo.default_og_image_id`, bloqueado por B11 — ver W1/W6).
 */
export function buildProductJsonLd(params: {
  siteUrl: string;
  storeName: string;
  url: string;
  product: ProductDetail;
}): Record<string, unknown> {
  const { siteUrl, storeName, url, product } = params;
  const image = resolveAbsoluteDetailImage(siteUrl, product.images);

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name ?? '',
    description: product.shortDescription ?? '',
    sku: product.sku ?? '',
    brand: { '@type': 'Brand', name: storeName },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: product.currency ?? '',
      price: product.effectivePrice ?? product.price ?? 0,
      availability: product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };
  if (image) {
    json['image'] = [image];
  }
  return json;
}

export function buildItemListJsonLd(params: { siteUrl: string; products: readonly ProductCard[] }): Record<
  string,
  unknown
> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: params.products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${params.siteUrl}/p/${product.slug}`,
      name: product.name ?? '',
    })),
  };
}

/**
 * Un solo nivel: no hay ruta de categoría propia (son filtros de `/`), así
 * que no hay ningún nivel intermedio real que enlazar.
 */
export function buildBreadcrumbJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: $localize`:@@seo.breadcrumbHome:Inicio`, item: `${siteUrl}/` },
    ],
  };
}

/** Sin `logo`: `settings.store.logo_image_id` sigue bloqueado por B11. */
export function buildOrganizationJsonLd(params: { siteUrl: string; storeName: string }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: params.storeName,
    url: params.siteUrl,
  };
}
