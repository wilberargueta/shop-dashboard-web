import { CurrencyPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FocusTrap } from '../../../shared/focus-trap/focus-trap';
import { ProductPrice } from '../../../shared/product-price/product-price';
import { QuantityStepper } from '../../../shared/quantity-stepper/quantity-stepper';
import { SelectionLine } from '../selection.model';

/**
 * Diálogo "Ver" de la barra de selección (PROJECT_SPEC.md §7): mismo
 * esqueleto de accesibilidad que `ProductDetailModal` (W7) —
 * `role="dialog"`, `aria-modal`, `appFocusTrap`, `Escape`/fondo cierran.
 * Puramente presentacional: recibe las líneas ya resueltas y solo emite
 * cambios de cantidad, quitar una línea y las dos acciones de la barra.
 */
@Component({
  selector: 'app-selection-panel',
  imports: [CurrencyPipe, ProductPrice, QuantityStepper, FocusTrap],
  templateUrl: './selection-panel.html',
  styleUrl: './selection-panel.scss',
})
export class SelectionPanel {
  readonly lines = input.required<readonly SelectionLine[]>();
  readonly subtotal = input.required<number>();
  readonly currency = input<string | undefined>(undefined);
  readonly returnFocusTo = input<HTMLElement | null>(null);

  readonly quantityChange = output<{ productId: string; quantity: number }>();
  readonly remove = output<string>();
  readonly closed = output<void>();
  readonly sendRequested = output<void>();

  protected readonly titleId = 'selection-panel-title';

  protected removeLabelId(productId: string): string {
    return `selection-panel-remove-${productId}`;
  }

  protected onClose(): void {
    this.closed.emit();
  }
}
