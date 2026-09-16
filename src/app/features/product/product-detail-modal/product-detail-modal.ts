import { Component, computed, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { FocusTrap } from '../../../shared/focus-trap/focus-trap';
import { ProductDetailSkeleton } from '../../../shared/product-detail-skeleton/product-detail-skeleton';
import { SelectionService } from '../../selection/selection.service';
import { toSelectionLine } from '../../selection/selection.model';
import { WhatsAppPreviewService } from '../../selection/whatsapp-preview/whatsapp-preview.service';
import {
  AddToSelectionEvent,
  ProductDetailContent,
  WhatsAppRequestedEvent,
} from '../product-detail-content/product-detail-content';

/**
 * Modal de detalle sobre el grid (W7): mismo `ProductDetailContent` de W6,
 * cargado bajo demanda. A diferencia de `ProductDetailPage`, este contenedor
 * nunca se renderiza en servidor (solo aparece tras una interacción del
 * usuario), así que no toca `RESPONSE_INIT` ni `Title`/`Meta` — los meta
 * tags reales para compartir el enlace ya los pone `ProductDetailPage`
 * cuando alguien entra o recarga en `/p/:slug`.
 */
@Component({
  selector: 'app-product-detail-modal',
  imports: [ProductDetailContent, ProductDetailSkeleton, FocusTrap],
  templateUrl: './product-detail-modal.html',
  styleUrl: './product-detail-modal.css',
})
export class ProductDetailModal {
  readonly slug = input.required<string>();
  readonly returnFocusTo = input<HTMLElement | null>(null);

  readonly closed = output<void>();

  protected readonly titleId = 'product-detail-modal-title';

  private readonly publicCatalogController = inject(PublicCatalogControllerService);
  protected readonly selection = inject(SelectionService);
  private readonly whatsappPreview = inject(WhatsAppPreviewService);

  private readonly productResource = rxResource({
    params: this.slug,
    stream: ({ params }) => this.publicCatalogController.getProduct({ slug: params }),
  });

  protected readonly isLoading = computed(() => this.productResource.isLoading());
  protected readonly hasError = computed(() => this.productResource.status() === 'error');
  /** `.value()` lanza si el estado no es 'resolved' (mismo patrón que `ProductDetailPage`/`CatalogPage`). */
  protected readonly product = computed(() =>
    this.productResource.status() === 'resolved' ? this.productResource.value() : undefined,
  );
  protected readonly isSelected = computed(() => {
    const productId = this.product()?.id;
    return productId !== undefined && this.selection.isSelected(productId);
  });
  protected readonly selectionCapReached = this.selection.capReached;

  protected onClose(): void {
    this.closed.emit();
  }

  protected onAddToSelection(event: AddToSelectionEvent): void {
    this.selection.add(event.product, event.quantity);
  }

  protected onRemoveFromSelection(productId: string): void {
    this.selection.remove(productId);
  }

  protected onWhatsappRequested({ product, quantity }: WhatsAppRequestedEvent): void {
    const line = toSelectionLine(product, quantity);
    if (!line) {
      return;
    }
    this.whatsappPreview.openWith([line], document.activeElement as HTMLElement | null);
  }
}
