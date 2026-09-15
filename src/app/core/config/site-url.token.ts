import { InjectionToken } from '@angular/core';

/**
 * Origen público y absoluto del sitio (sin barra final), usado para construir
 * URLs absolutas en metaetiquetas (`og:image`, `og:url`) y, más adelante, en
 * `{{url}}` de las plantillas de WhatsApp (ARQUITECTURA.md §6). A diferencia
 * de `API_BASE_URL`, tiene el mismo valor absoluto en servidor y en
 * navegador: una metaetiqueta servida al navegador necesita una URL absoluta
 * igual, no una relativa.
 */
export const SITE_URL = new InjectionToken<string>('SITE_URL');
