import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { MAX_SELECTION } from './core/config/max-selection.token';
import { SITE_URL } from './core/config/site-url.token';
import { Configuration } from './api/configuration';
import { ApiConfiguration } from './core/http/api-configuration';
import { traceIdInterceptor } from './core/http/trace-id.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';

// Relativa en el navegador: PROJECT_SPEC.md §8. Absoluta en app.config.server.ts.
const apiBaseUrl = '';

// Siempre absoluta, igual en servidor y navegador: alimenta metaetiquetas
// (`og:image`, `og:url`) que viajan tal cual en el HTML servido.
const siteUrl = 'http://localhost:4200';

// `catalog.max_selection` (ARQUITECTURA.md §4.6): `PublicSettings` todavía no
// existe en el cliente generado (bloqueado por B11 del backend, misma
// desviación de W1/W8). Valor fijo por ahora, igual en servidor y navegador.
const maxSelection = 20;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(withInterceptors([traceIdInterceptor, apiErrorInterceptor])),
    { provide: API_BASE_URL, useValue: apiBaseUrl },
    { provide: SITE_URL, useValue: siteUrl },
    { provide: MAX_SELECTION, useValue: maxSelection },
    { provide: Configuration, useValue: new ApiConfiguration({ basePath: apiBaseUrl }) },
  ],
};
