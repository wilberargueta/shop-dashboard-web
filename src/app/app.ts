import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SITE_URL } from './core/config/site-url.token';
import { WHATSAPP_SETTINGS } from './core/config/whatsapp-settings.token';
import { buildOrganizationJsonLd } from './core/seo/seo.schema';
import { SeoService } from './core/seo/seo.service';
import { SelectionRoot } from './features/selection/selection-root/selection-root';
import { SelectionService } from './features/selection/selection.service';
import { WhatsAppPreviewDialog } from './features/selection/whatsapp-preview/whatsapp-preview-dialog/whatsapp-preview-dialog';
import { WhatsAppPreviewService } from './features/selection/whatsapp-preview/whatsapp-preview.service';

@Component({
  imports: [RouterOutlet, SelectionRoot, WhatsAppPreviewDialog],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  /**
   * `SelectionRoot`/el diálogo de vista previa de WhatsApp (montados una vez
   * aquí, hermanos de `<router-outlet>`) necesitan saber si están abiertos
   * para poner `inert` en el resto de la app (PROJECT_SPEC.md §6, regla 7 del
   * modal, aplicada igual a estos dos diálogos): viven fuera del árbol de
   * `<router-outlet>`, así que es `App` quien puede envolverlo.
   */
  protected readonly selection = inject(SelectionService);
  protected readonly whatsappPreview = inject(WhatsAppPreviewService);

  constructor() {
    // Organization JSON-LD, una sola vez para toda la app (W11): `App` es el
    // único componente montado siempre — no hay un componente de layout real
    // todavía (`src/app/layout/` sigue vacío desde W0).
    const seo = inject(SeoService);
    const siteUrl = inject(SITE_URL);
    const storeName = inject(WHATSAPP_SETTINGS).storeName;
    seo.setJsonLd('ld-organization', buildOrganizationJsonLd({ siteUrl, storeName }));
  }
}
