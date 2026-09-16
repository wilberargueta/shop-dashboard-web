import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AnalyticsEventService } from '../../../../core/analytics/analytics-event.service';
import { WHATSAPP_SETTINGS } from '../../../../core/config/whatsapp-settings.token';
import { FocusTrap } from '../../../../shared/focus-trap/focus-trap';
import { WhatsAppSelectionLine } from '../../whatsapp-template/whatsapp-template.model';
import { WhatsAppTemplateService } from '../../whatsapp-template/whatsapp-template.service';

/**
 * Diálogo de vista previa del mensaje de WhatsApp (W10): mismo esqueleto de
 * accesibilidad que `SelectionPanel`/`ProductDetailModal` — `role="dialog"`,
 * `aria-modal`, `appFocusTrap`, `Escape`/fondo cierran. Se abre desde la
 * tarjeta, el detalle o la barra de selección vía `WhatsAppPreviewService`,
 * y siempre recibe las líneas ya resueltas: no llama a la API.
 */
@Component({
  selector: 'app-whatsapp-preview-dialog',
  imports: [FocusTrap],
  templateUrl: './whatsapp-preview-dialog.html',
  styleUrl: './whatsapp-preview-dialog.css',
})
export class WhatsAppPreviewDialog {
  readonly lines = input.required<readonly WhatsAppSelectionLine[]>();
  readonly returnFocusTo = input<HTMLElement | null>(null);

  readonly closed = output<void>();

  protected readonly titleId = 'whatsapp-preview-dialog-title';

  private readonly whatsAppTemplateService = inject(WhatsAppTemplateService);
  private readonly analyticsEventService = inject(AnalyticsEventService);
  private readonly settings = inject(WHATSAPP_SETTINGS);

  protected readonly message = computed(() =>
    this.whatsAppTemplateService.renderMessage(this.lines(), this.settings.templates, {
      storeName: this.settings.storeName,
    }),
  );

  protected readonly url = computed(() =>
    this.whatsAppTemplateService.buildWhatsAppUrl(this.settings.phoneNumber, this.message()),
  );

  protected readonly copyAnnouncement = signal('');

  protected onClose(): void {
    this.closed.emit();
  }

  /**
   * El evento de analítica es disparar-y-olvidar: su resultado (o su fallo)
   * nunca condiciona `window.open`. `AnalyticsEventService` ya garantiza no
   * relanzar nada, pero el `try/catch` de aquí es la defensa que realmente
   * importa para el criterio de aceptación ("un fallo del evento de
   * analítica no impide la redirección"): sin ella, un fallo inesperado en
   * la llamada de analítica sí impediría llegar al `window.open` siguiente.
   */
  protected onSend(): void {
    try {
      this.analyticsEventService.sendWhatsAppClick(this.lines().length);
    } catch {
      // Nunca debe impedir la redirección a WhatsApp.
    }
    window.open(this.url(), '_blank', 'noopener,noreferrer');
  }

  protected onCopy(): void {
    navigator.clipboard
      .writeText(this.message())
      .then(() => this.copyAnnouncement.set($localize`:@@whatsappPreviewDialog.copied:Copiado.`))
      .catch(() => this.copyAnnouncement.set(''));
  }
}
