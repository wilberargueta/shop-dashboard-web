import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { Configuration } from './api/configuration';
import { ApiConfiguration } from './core/http/api-configuration';
import { traceIdInterceptor } from './core/http/trace-id.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';

// Relativa en el navegador: PROJECT_SPEC.md §8. Absoluta en app.config.server.ts.
const apiBaseUrl = '';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withInterceptors([traceIdInterceptor, apiErrorInterceptor])),
    { provide: API_BASE_URL, useValue: apiBaseUrl },
    { provide: Configuration, useValue: new ApiConfiguration({ basePath: apiBaseUrl }) },
  ],
};
