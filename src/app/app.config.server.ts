import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { SITE_URL } from './core/config/site-url.token';
import { Configuration } from './api/configuration';
import { ApiConfiguration } from './core/http/api-configuration';

// Absoluta en el servidor: PROJECT_SPEC.md §8, no hay origen implícito en SSR.
const apiBaseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:8080';

// Mismo valor absoluto que en app.config.ts (nunca relativo): ver site-url.token.ts.
const siteUrl = process.env['SITE_URL'] ?? 'http://localhost:4200';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE_URL, useValue: apiBaseUrl },
    { provide: SITE_URL, useValue: siteUrl },
    { provide: Configuration, useValue: new ApiConfiguration({ basePath: apiBaseUrl }) },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
