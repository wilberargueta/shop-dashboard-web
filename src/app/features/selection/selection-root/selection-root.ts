import { CurrencyPipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { SelectionBar } from '../selection-bar/selection-bar';
import { SelectionPanel } from '../selection-panel/selection-panel';
import { SelectionService } from '../selection.service';

/**
 * Montado una sola vez en `App`, hermano de `<router-outlet>` (nunca por
 * página): la selección sobrevive a navegar entre `/`, `/p/:slug` y el
 * modal, y la región `aria-live` de abajo necesita persistir en el DOM para
 * que su cambio de texto se anuncie de verdad — un montaje por página la
 * destruiría y recrearía en cada navegación.
 */
@Component({
  selector: 'app-selection-root',
  imports: [CurrencyPipe, SelectionBar, SelectionPanel],
  templateUrl: './selection-root.html',
  styleUrl: './selection-root.css',
})
export class SelectionRoot {
  protected readonly selection = inject(SelectionService);

  constructor() {
    // Si la selección se vacía (se quita el último producto, o el restore
    // descarta todas las líneas) el panel abierto ya no tiene qué mostrar.
    effect(() => {
      if (this.selection.count() === 0 && this.selection.panelOpen()) {
        this.selection.closePanel();
      }
    });
  }

  protected onViewRequested(): void {
    this.selection.openPanel(document.activeElement as HTMLElement | null);
  }

  /**
   * El renderizado real del mensaje (W10) necesita las plantillas de
   * WhatsApp, que tampoco están disponibles todavía vía `PublicSettings`
   * (mismo bloqueo de B11 documentado en W1/W8). Mientras tanto, "Enviar por
   * WhatsApp" abre el panel de selección — igual que "Ver" — en vez de dejar
   * un botón sin ningún efecto.
   */
  protected onSendRequested(): void {
    this.onViewRequested();
  }
}
