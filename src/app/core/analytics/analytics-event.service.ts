import { PLATFORM_ID, Injectable, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { API_BASE_URL } from '../config/api-base-url.token';
import { getOrCreateSessionId } from './session-id';

interface WhatsAppClickPayload {
  productCount: number;
}

/**
 * Envía `WHATSAPP_CLICK` a `POST /api/public/v1/events`
 * (ARQUITECTURA.md §4.7/§5.1). El backend todavía no implementa esta ruta
 * (`B14` de su ROADMAP sigue sin hacer, a diferencia de `B11`/settings): se
 * implementa igual, sin pasar por el cliente generado (su semántica de
 * disparar-y-olvidar no encaja en los métodos `Observable` que genera
 * `openapi-generator`, y así lo pide `PROJECT_SPEC.md` explícitamente:
 * `sendBeacon`/`fetch keepalive`). Queda pendiente verificar el cuerpo real
 * de la respuesta contra un backend con `B14` hecho.
 *
 * Nunca puede impedir la redirección a WhatsApp de quien la invoque: todo el
 * método está protegido, no relanza nada.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsEventService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  sendWhatsAppClick(productCount: number, productId?: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const url = `${this.apiBaseUrl}/api/public/v1/events`;
      const body = JSON.stringify({
        type: 'WHATSAPP_CLICK',
        productId,
        payload: { productCount } satisfies WhatsAppClickPayload,
        sessionId: getOrCreateSessionId(),
      });

      const sent =
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));

      if (!sent) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {
          // La analítica nunca puede impedir que el visitante llegue a WhatsApp.
        });
      }
    } catch {
      // Igual: un fallo aquí se ignora en silencio.
    }
  }
}
