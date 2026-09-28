import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

/**
 * Precio con descuento, compartido por `ProductCard` y `ProductDetailContent`
 * para que el marcado sensible a accesibilidad (precio tachado + etiqueta
 * "precio anterior" oculta + insignia de porcentaje) no diverja entre los
 * dos sitios que lo muestran.
 */
@Component({
  selector: 'app-product-price',
  imports: [CurrencyPipe],
  templateUrl: './product-price.html',
  styleUrl: './product-price.css',
})
export class ProductPrice {
  readonly price = input<number | undefined>(undefined);
  readonly effectivePrice = input<number | undefined>(undefined);
  readonly currency = input<string | undefined>(undefined);
  readonly onSale = input(false);
  readonly discountPercentage = input<number | undefined>(undefined);

  protected readonly hasDiscount = computed(() => this.onSale() && this.discountPercentage() != null);
}
