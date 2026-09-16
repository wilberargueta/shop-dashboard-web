import { Component, computed, input, output } from '@angular/core';
import { SkeletonCard } from '../../../shared/skeleton-card/skeleton-card';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';
import { ProductCard, ProductCardOpenEvent } from '../product-card/product-card';

const PRIORITY_COUNT = 6;
const TRAILING_SKELETON_COUNT = 3;

@Component({
  selector: 'app-product-grid',
  imports: [ProductCard, SkeletonCard],
  templateUrl: './product-grid.html',
  styleUrl: './product-grid.css',
})
export class ProductGrid {
  readonly products = input<readonly ProductCardDto[]>([]);
  readonly loading = input(false);
  /** Ya hay productos en pantalla; se está pidiendo el siguiente lote (W4). */
  readonly loadingMore = input(false);
  readonly skeletonCount = input(PRIORITY_COUNT);

  /** Reenvía el `open` de la tarjeta que se pulsó (W7): sin lógica propia. */
  readonly productOpen = output<ProductCardOpenEvent>();

  protected readonly priorityCount = PRIORITY_COUNT;
  protected readonly showSkeletons = computed(() => this.loading() && this.products().length === 0);
  protected readonly skeletonIndexes = computed(() =>
    Array.from({ length: this.skeletonCount() }, (_, index) => index),
  );
  protected readonly trailingSkeletonIndexes = computed(() =>
    Array.from({ length: TRAILING_SKELETON_COUNT }, (_, index) => index),
  );
}
