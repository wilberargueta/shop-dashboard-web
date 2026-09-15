import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  readonly product = input.required<ProductCardDto>();
  readonly priority = input(false);

  protected readonly cardImage = computed(() => this.product().primaryImage?.card ?? null);

  /** Ver el ejemplo de <picture> en PROJECT_SPEC.md §5; debe coincidir con las columnas reales del grid. */
  protected readonly imageSizes = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw';

  protected readonly cardSrcsetWebp = computed(() => {
    const image = this.cardImage();
    return image?.webp ? `${image.webp} ${image.width ?? 600}w` : null;
  });

  protected readonly cardSrcsetFallback = computed(() => {
    const image = this.cardImage();
    const url = image?.jpeg ?? image?.webp;
    return url ? `${url} ${image?.width ?? 600}w` : null;
  });

  protected readonly hasDiscount = computed(() => {
    const product = this.product();
    return !!product.onSale && product.discountPercentage != null;
  });

  protected readonly outOfStockReasonId = computed(() => `product-card-oos-${this.product().id}`);
}
