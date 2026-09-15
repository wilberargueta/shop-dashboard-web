import { Component, computed, input } from '@angular/core';
import { ProductDetail } from '../../../api/model/product-detail';
import { ProductImageCarousel } from '../product-image-carousel/product-image-carousel';
import { ProductPrice } from '../../../shared/product-price/product-price';
import { QuantityStepper } from '../../../shared/quantity-stepper/quantity-stepper';

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

  protected readonly images = computed(() => this.product().images ?? []);
}
