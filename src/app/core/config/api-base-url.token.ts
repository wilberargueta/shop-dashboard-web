import { InjectionToken } from '@angular/core';

/**
 * Ver PROJECT_SPEC.md §8: absoluta en servidor (SSR llama directo al backend),
 * puede quedar relativa en el navegador. W1 la consume desde el interceptor HTTP.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
