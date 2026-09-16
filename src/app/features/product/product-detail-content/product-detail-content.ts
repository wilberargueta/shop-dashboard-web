import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { ProductDetail } from '../../../api/model/product-detail';
import { ProductImageCarousel } from '../product-image-carousel/product-image-carousel';
import { ProductPrice } from '../../../shared/product-price/product-price';
import { QuantityStepper } from '../../../shared/quantity-stepper/quantity-stepper';

export interface AddToSelectionEvent {
  product: ProductDetail;
  quantity: number;
}

/**
 * Ancla responsive del ROADMAP (W6): todo el contenido del detalle vive
 * aquí, sin saber nada de su contenedor. W7 lo usa dentro de un modal; W13
 * dentro de una hoja a pantalla completa en móvil. Presentación pura, sin
 * llamadas a la API — los datos entran por `input()`.
 */
@Component({
  selector: 'app-product-detail-content',
  imports: [ProductImageCarousel, ProductPrice, QuantityStepper],
  templateUrl: './product-detail-content.html',
  styleUrl: './product-detail-content.css',
})
export class ProductDetailContent {
  readonly product = input.required<ProductDetail>();
  /** El modal de W7 lo usa para `aria-labelledby`; la página standalone no lo necesita. */
  readonly titleId = input<string | null>(null);
  /** El producto ya está en la selección (W9): controla si el botón dice "Añadir" o "Quitar". */
  readonly selected = input(false);
  /** Tope de selección alcanzado y este producto todavía no está seleccionado (W9). */
  readonly selectionDisabled = input(false);

  readonly addToSelection = output<AddToSelectionEvent>();
  readonly removeFromSelection = output<string>();

  protected readonly images = computed(() => this.product().images ?? []);

  /** Cantidad a añadir, distinta de cualquier cantidad ya guardada en la selección. */
  protected readonly addQuantity = signal(1);
  protected readonly addDisabled = computed(
    () => this.product().inStock === false || (this.selectionDisabled() && !this.selected()),
  );
  protected readonly addReasonId = computed(() => `product-detail-content-add-reason-${this.product().id}`);

  constructor() {
    // Reinicia la cantidad al navegar a otro producto (el modal reutiliza la
    // misma instancia al cambiar de slug).
    effect(() => {
      this.product();
      untracked(() => this.addQuantity.set(1));
    });
  }

  protected onAddClick(): void {
    if (this.selected()) {
      const productId = this.product().id;
      if (productId) {
        this.removeFromSelection.emit(productId);
      }
      return;
    }
    if (this.addDisabled()) {
      return;
    }
    this.addToSelection.emit({ product: this.product(), quantity: this.addQuantity() });
    this.addQuantity.set(1);
  }
}
