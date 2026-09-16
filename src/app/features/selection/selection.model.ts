import { ImageRef } from '../../api/model/image-ref';

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
