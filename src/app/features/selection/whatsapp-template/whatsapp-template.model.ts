export interface WhatsAppTemplateSet {
  single: string;
  multiHeader: string;
  multiItem: string;
  multiFooter: string;
}

/**
 * Nombres de campo alineados con `ProductCard`/`ProductDetail` de
 * `src/app/api/model/`, sin importar esos tipos: el servicio no depende del
 * cliente generado, para poder usarse antes de que `PublicSettings` exista
 * (bloqueado por B11 del backend, misma desviación documentada en W1).
 */
export interface WhatsAppSelectionLine {
  name: string;
  sku: string;
  slug: string;
  price: number;
  effectivePrice: number;
  currency: string;
  discountPercentage?: number;
  quantity: number;
}

export interface WhatsAppRenderContext {
  storeName: string;
  /** Para hacer `{{fecha}}` determinista en tests. Por defecto, `new Date()`. */
  now?: Date;
}
