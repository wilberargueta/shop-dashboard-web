import { InjectionToken } from '@angular/core';
import { WhatsAppTemplateSet } from '../../features/selection/whatsapp-template/whatsapp-template.model';

export interface WhatsAppSettings {
  /** E.164 sin `+` (ARQUITECTURA.md §6 "Formato del número"), ej. `50370000000`. */
  phoneNumber: string;
  templates: WhatsAppTemplateSet;
  storeName: string;
}

/**
 * `store.name` viene del backoffice ("Datos de mi tienda"), cargado al
 * arrancar por `StoreName` (`GET /api/public/v1/settings`). El número de
 * WhatsApp y las plantillas (`whatsapp.phone_number`/`whatsapp.template_*`,
 * ARQUITECTURA.md §4.6) siguen siendo un valor fijo, igual en servidor y
 * navegador, mismo patrón que `MAX_SELECTION`/`SITE_URL`: el endpoint ya los
 * expone, pero todavía no se leen de ahí. Las plantillas por defecto son las de la migración inicial del backend
 * (ARQUITECTURA.md §6 "Valores por defecto"); el número es un valor de
 * ejemplo, no uno real — el backend siembra `whatsapp.phone_number = ''`
 * hasta que el administrador lo configura.
 */
export const WHATSAPP_SETTINGS = new InjectionToken<WhatsAppSettings>('WHATSAPP_SETTINGS');
