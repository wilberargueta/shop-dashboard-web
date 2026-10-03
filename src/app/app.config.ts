import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsSv from '@angular/common/locales/es-SV';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { MAX_SELECTION } from './core/config/max-selection.token';
import { SITE_URL } from './core/config/site-url.token';
import { WHATSAPP_SETTINGS, WhatsAppSettings } from './core/config/whatsapp-settings.token';
import { Configuration } from './api/configuration';
import { ApiConfiguration } from './core/http/api-configuration';
import { traceIdInterceptor } from './core/http/trace-id.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';

// `es-SV`, no `es`: `Intl.NumberFormat('es', ...)` da "20,00 US$"
// (formato de España), que contradice el mockup de PROJECT_SPEC.md
// ("$65.00") y el formato que WhatsAppTemplateService ya fija a `es-SV`
// desde W8 ("$20.00"). Sin este registro, LOCALE_ID cae al `sourceLocale`
// de angular.json ("es"), y CurrencyPipe formatea distinto a como se ve el
// mismo precio en el mensaje de WhatsApp para el mismo producto.
registerLocaleData(localeEsSv);

// Relativa en el navegador: PROJECT_SPEC.md §8. Absoluta en app.config.server.ts.
const apiBaseUrl = '';

// Siempre absoluta, igual en servidor y navegador: alimenta metaetiquetas
// (`og:image`, `og:url`) que viajan tal cual en el HTML servido.
const siteUrl = 'http://localhost:4200';

// `catalog.max_selection` (ARQUITECTURA.md §4.6): `PublicSettings` todavía no
// existe en el cliente generado (bloqueado por B11 del backend, misma
// desviación de W1/W8). Valor fijo por ahora, igual en servidor y navegador.
const maxSelection = 20;

// `whatsapp.phone_number`/`whatsapp.template_*`/`store.name` (ARQUITECTURA.md
// §4.6): ver whatsapp-settings.token.ts. Plantillas por defecto de
// ARQUITECTURA.md §6 "Valores por defecto que van en la migración inicial".
const whatsappSettings: WhatsAppSettings = {
  phoneNumber: '50370000000',
  storeName: "Gabys Beauty's Store",
  templates: {
    single: `¡Hola! Me interesa este producto de {{tienda}}:

*{{producto}}*
SKU: {{sku}}
Precio: {{precio}}
Cantidad: {{cantidad}}
Total: {{subtotal}}

{{url}}`,
    multiHeader: '¡Hola! Me interesan estos productos de {{tienda}}:',
    multiItem: `• *{{producto}}* (x{{cantidad}}) — {{subtotal}}
  {{url}}`,
    multiFooter: `
*Total: {{total}}* ({{unidades}} unidades)`,
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(withInterceptors([traceIdInterceptor, apiErrorInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-SV' },
    { provide: API_BASE_URL, useValue: apiBaseUrl },
    { provide: SITE_URL, useValue: siteUrl },
    { provide: MAX_SELECTION, useValue: maxSelection },
    { provide: WHATSAPP_SETTINGS, useValue: whatsappSettings },
    { provide: Configuration, useValue: new ApiConfiguration({ basePath: apiBaseUrl }) },
  ],
};
