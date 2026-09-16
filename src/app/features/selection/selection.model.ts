import { ImageRef } from '../../api/model/image-ref';
import { ProductCard as ProductCardDto } from '../../api/model/product-card';
import { ProductDetail } from '../../api/model/product-detail';

/**
 * Forma persistida en `sessionStorage` — literalmente `{ productId, cantidad }`
 * más `slug`, necesario porque la API pública no tiene forma de buscar un
 * producto por id ni en lote (solo `getProduct({slug})` y `listProducts()`
 * sin filtro por id): restaurar la selección exige volver a pedir cada línea
 * por su slug. Nunca lleva precio (CLAUDE.md: "No guardar precios en
 * sessionStorage. Solo { productId, cantidad }").
 */
export interface StoredSelectionLine {
  productId: string;
  slug: string;
  cantidad: number;
}

/**
 * Línea de selección ya resuelta con datos frescos de la API. Nombres de
 * campo alineados con `WhatsAppSelectionLine` (W8) para que W10 pueda pasar
 * `lines` directo a `WhatsAppTemplateService.renderMessage()`.
 */
export interface SelectionLine {
  productId: string;
  slug: string;
  quantity: number;
  name: string;
  sku: string;
  price: number;
  effectivePrice: number;
  currency: string;
  onSale: boolean;
  discountPercentage?: number;
  inStock: boolean;
  primaryImage?: ImageRef;
}

export type SelectableProduct = ProductCardDto | ProductDetail;

/**
 * Mapeo compartido `ProductCard|ProductDetail → SelectionLine`, usado por
 * `SelectionService` (W9) y por el flujo de WhatsApp individual desde la
 * tarjeta/el detalle (W10) — una línea sin `id`/`slug` no se puede enviar ni
 * seleccionar, así que ambos casos comparten la misma validación.
 */
export function toSelectionLine(product: SelectableProduct, quantity: number): SelectionLine | null {
  if (!product.id || !product.slug) {
    return null;
  }
  return {
    productId: product.id,
    slug: product.slug,
    quantity,
    name: product.name ?? '',
    sku: product.sku ?? '',
    price: product.price ?? 0,
    effectivePrice: product.effectivePrice ?? product.price ?? 0,
    currency: product.currency ?? 'USD',
    onSale: product.onSale ?? false,
    discountPercentage: product.discountPercentage,
    inStock: product.inStock ?? true,
    primaryImage: product.primaryImage,
  };
}
