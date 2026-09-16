import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
}
