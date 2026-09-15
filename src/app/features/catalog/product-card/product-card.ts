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

  protected readonly hasDiscount = computed(() => {
    const product = this.product();
    return !!product.onSale && product.discountPercentage != null;
  });
}
