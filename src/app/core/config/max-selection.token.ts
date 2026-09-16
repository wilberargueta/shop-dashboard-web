import { InjectionToken } from '@angular/core';

/**
 * Tope de productos seleccionables a la vez (`catalog.max_selection`,
 * ARQUITECTURA.md §4.6, por defecto 20). `PublicSettings` todavía no existe
 * en el cliente generado (bloqueado por B11 del backend, misma desviación
 * documentada en W1/W8): mientras tanto es un valor fijo por entorno, igual
 * que `SITE_URL`/`API_BASE_URL`.
 */
export const MAX_SELECTION = new InjectionToken<number>('MAX_SELECTION');
