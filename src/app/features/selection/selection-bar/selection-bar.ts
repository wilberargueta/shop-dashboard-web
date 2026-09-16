import { CurrencyPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

/**
 * Barra fija inferior (PROJECT_SPEC.md §7), puramente presentacional: recibe
 * conteo/total ya calculados por `SelectionService` y solo emite las dos
 * acciones. Botones nativos: operables por teclado sin manejo propio, mismo
 * criterio que `CatalogLoadMore`.
 */
@Component({
  selector: 'app-selection-bar',
  imports: [CurrencyPipe],
  templateUrl: './selection-bar.html',
  styleUrl: './selection-bar.css',
})
export class SelectionBar {
  readonly count = input.required<number>();
  readonly subtotal = input.required<number>();
  readonly currency = input<string | undefined>(undefined);

  readonly viewRequested = output<void>();
  readonly sendRequested = output<void>();
}
