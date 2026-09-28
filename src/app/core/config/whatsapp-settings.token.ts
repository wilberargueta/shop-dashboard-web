import { InjectionToken } from '@angular/core';
import { WhatsAppTemplateSet } from '../../features/selection/whatsapp-template/whatsapp-template.model';

export interface WhatsAppSettings {
  /** E.164 sin `+` (ARQUITECTURA.md §6 "Formato del número"), ej. `50370000000`. */
  phoneNumber: string;
  templates: WhatsAppTemplateSet;
  storeName: string;
}

/**
 * `whatsapp.phone_number`/`whatsapp.template_*`/`store.name`
 * (ARQUITECTURA.md §4.6): `PublicSettings` todavía no existe en el cliente
 * generado aquí — `B11` del backend ya está hecho, pero este repo no ha
 * vuelto a correr `pnpm api:generate` desde entonces. Valor fijo por ahora,
 * igual en servidor y navegador, mismo patrón que `MAX_SELECTION`/`SITE_URL`.
 * Las plantillas por defecto son las de la migración inicial del backend
 * (ARQUITECTURA.md §6 "Valores por defecto"); el número es un valor de
 * ejemplo, no uno real — el backend siembra `whatsapp.phone_number = ''`
 * hasta que el administrador lo configura.
 */
export const WHATSAPP_SETTINGS = new InjectionToken<WhatsAppSettings>('WHATSAPP_SETTINGS');
