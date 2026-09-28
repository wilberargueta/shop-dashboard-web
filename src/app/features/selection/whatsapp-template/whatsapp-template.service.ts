import { Injectable, inject } from '@angular/core';
import { SITE_URL } from '../../../core/config/site-url.token';
import type {
  WhatsAppRenderContext,
  WhatsAppSelectionLine,
  WhatsAppTemplateSet,
} from './whatsapp-template.model';

const MAX_MESSAGE_LENGTH = 1500;
const LOCALE = 'es-SV';

const EMPTY_PRODUCT_MARKERS: Readonly<Record<string, string>> = {
  producto: '',
  precio: '',
  cantidad: '',
  url: '',
  sku: '',
  precio_lista: '',
  descuento: '',
  subtotal: '',
  moneda: '',
};

function substitute(template: string, markers: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string): string =>
    key in markers ? markers[key] : match,
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Renderiza el mensaje de WhatsApp exactamente según ARQUITECTURA.md §6: es
 * la pieza que decide si una venta ocurre. El backend implementa las mismas
 * reglas (las usa el preview del backoffice) y ambos deben producir texto
 * idéntico — ver `whatsapp-golden.json` en la estrategia de pruebas.
 *
 * Recibe las plantillas y los datos ya resueltos como parámetros propios, sin
 * depender de `PublicSettings` (todavía no existe en el cliente generado:
 * bloqueado por B11 del backend, misma desviación documentada en W1).
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppTemplateService {
  private readonly siteUrl = inject(SITE_URL);

  /** `lines` nunca está vacío: el llamador solo invoca esto con una selección real. */
  renderMessage(
    lines: readonly WhatsAppSelectionLine[],
    templates: WhatsAppTemplateSet,
    context: WhatsAppRenderContext,
  ): string {
    const now = context.now ?? new Date();
    const global = this.globalMarkers(lines, context.storeName, now);

    if (lines.length === 1) {
      return substitute(templates.single, { ...global, ...this.productMarkers(lines[0]) });
    }

    const header = substitute(templates.multiHeader, { ...global, ...EMPTY_PRODUCT_MARKERS });
    const footer = substitute(templates.multiFooter, { ...global, ...EMPTY_PRODUCT_MARKERS });
    const items = lines.map((line) =>
      substitute(templates.multiItem, { ...global, ...this.productMarkers(line) }),
    );

    return this.renderMulti(header, items, footer);
  }

  buildWhatsAppUrl(phoneNumber: string, message: string): string {
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  }

  private productMarkers(line: WhatsAppSelectionLine): Record<string, string> {
    return {
      producto: line.name,
      precio: formatCurrency(line.effectivePrice, line.currency),
      cantidad: String(line.quantity),
      url: `${this.siteUrl}/p/${line.slug}`,
      sku: line.sku,
      precio_lista: formatCurrency(line.price, line.currency),
      descuento: `${line.discountPercentage ?? 0}%`,
      subtotal: formatCurrency(line.effectivePrice * line.quantity, line.currency),
      moneda: line.currency,
    };
  }

  private globalMarkers(
    lines: readonly WhatsAppSelectionLine[],
    storeName: string,
    now: Date,
  ): Record<string, string> {
    const total = lines.reduce((sum, line) => sum + line.effectivePrice * line.quantity, 0);
    const unidades = lines.reduce((sum, line) => sum + line.quantity, 0);

    return {
      tienda: storeName,
      fecha: formatDate(now),
      total: formatCurrency(total, lines[0].currency),
      items: String(lines.length),
      unidades: String(unidades),
    };
  }

  /**
   * Estructura del mensaje multi-producto: `header + "\n" + items.join("\n")
   * + "\n" + footer`, calcada de `WhatsAppTemplateRenderer.join()` del
   * backend — las plantillas reales (`ARQUITECTURA.md` §6) no llevan sus
   * propios separadores entre encabezado/ítems/pie, así que ese salto lo
   * pone el renderizado, no la plantilla. Verificado contra
   * `whatsapp-golden.json` (caso 12).
   */
  private renderMulti(header: string, items: readonly string[], footer: string): string {
    const full = this.joinMulti(header, items, footer, 0);
    if (full.length <= MAX_MESSAGE_LENGTH) {
      return full;
    }

    /**
     * Regla 4 de ARQUITECTURA.md §6: si el mensaje supera 1500 caracteres, se
     * corta la lista de ítems y se añade "… y N productos más". Los totales
     * del pie ya se calcularon sobre la lista completa (en `globalMarkers`),
     * así que truncar aquí solo recorta qué líneas se muestran.
     */
    for (let keep = items.length - 1; keep >= 0; keep--) {
      const dropped = items.length - keep;
      const candidate = this.joinMulti(header, items.slice(0, keep), footer, dropped);
      if (candidate.length <= MAX_MESSAGE_LENGTH) {
        return candidate;
      }
    }
    return this.joinMulti(header, [], footer, items.length);
  }

  private joinMulti(header: string, items: readonly string[], footer: string, dropped: number): string {
    const notice = dropped > 0 ? `… y ${dropped} productos más\n` : '';
    const body = items.length === 0 ? '' : items.join('\n') + '\n';
    return header + '\n' + body + notice + footer;
  }
}
