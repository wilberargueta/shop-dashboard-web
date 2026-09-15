import { Component, computed, input, output } from '@angular/core';
import { IntersectOnVisible } from '../../../shared/intersection-observer/intersect-on-visible';

/**
 * Estado y controles del scroll infinito, siempre debajo de `ProductGrid`:
 * el centinela del `IntersectionObserver`, el botón accesible "Cargar
 * más"/"Reintentar" (real, aunque visualmente oculto — PROJECT_SPEC.md §3.7)
 * y el anuncio `aria-live` de lo que pasó con el último lote. No llama a la
 * API: solo pinta el estado que le llega y emite `loadMore`, igual que
 * `ProductGrid`.
 */
@Component({
  selector: 'app-catalog-load-more',
  imports: [IntersectOnVisible],
  templateUrl: './catalog-load-more.html',
  styleUrl: './catalog-load-more.css',
})
export class CatalogLoadMore {
  readonly hasNext = input(false);
  readonly loading = input(false);
  readonly hasError = input(false);
  /** Total de productos mostrados; cambia cada vez que llega un lote nuevo. */
  readonly count = input(0);

  readonly loadMore = output<void>();

  protected readonly showEnd = computed(() => !this.hasNext() && !this.loading() && !this.hasError());
  protected readonly sentinelDisabled = computed(() => this.loading() || this.hasError() || !this.hasNext());

  protected onTrigger(): void {
    this.loadMore.emit();
  }
}
