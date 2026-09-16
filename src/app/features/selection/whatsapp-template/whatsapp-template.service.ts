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
    const body = this.truncateItems(items, header.length + footer.length);

    return header + body + footer;
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
   * Regla 4 de ARQUITECTURA.md §6: si el mensaje supera 1500 caracteres, se
   * corta la lista de ítems y se añade "… y N productos más". El presupuesto
   * de cada paso ya reserva espacio para el sufijo que haría falta si el
   * siguiente ítem no entra, para no rebasar el límite por el sufijo mismo.
   */
  private truncateItems(items: readonly string[], headerAndFooterLength: number): string {
    let body = '';
    for (let i = 0; i < items.length; i++) {
      const candidate = body + items[i];
      const remainingAfter = items.length - (i + 1);
      const suffix = remainingAfter > 0 ? `… y ${remainingAfter} productos más` : '';
      if (headerAndFooterLength + candidate.length + suffix.length > MAX_MESSAGE_LENGTH) {
        return body + `… y ${items.length - i} productos más`;
      }
      body = candidate;
    }
    return body;
  }
}
