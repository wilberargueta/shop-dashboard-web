import { Injectable, signal } from '@angular/core';
import { WhatsAppSelectionLine } from '../whatsapp-template/whatsapp-template.model';

/**
 * Estado efímero del diálogo de vista previa de WhatsApp (W10): distinto de
 * `SelectionService`, que guarda la selección persistida. Este servicio solo
 * describe "lo que se está a punto de enviar ahora", que puede ser una sola
 * línea ad-hoc desde la tarjeta o el detalle sin tocar la selección guardada,
 * o las líneas completas de la selección cuando se abre desde la barra.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppPreviewService {
  private readonly openSignal = signal(false);
  private readonly linesSignal = signal<readonly WhatsAppSelectionLine[]>([]);
  private readonly returnFocusToSignal = signal<HTMLElement | null>(null);

  readonly open = this.openSignal.asReadonly();
  readonly lines = this.linesSignal.asReadonly();
  readonly returnFocusTo = this.returnFocusToSignal.asReadonly();

  openWith(lines: readonly WhatsAppSelectionLine[], returnFocusTo: HTMLElement | null = null): void {
    if (lines.length === 0) {
      return;
    }
    this.linesSignal.set(lines);
    this.returnFocusToSignal.set(returnFocusTo);
    this.openSignal.set(true);
  }

  close(): void {
    this.openSignal.set(false);
  }
}
