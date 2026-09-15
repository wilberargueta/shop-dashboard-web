import { Component, Signal, computed, effect, input, linkedSignal, output, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CategorySummary } from '../../../api/model/category-summary';
import { CatalogFilters, CatalogSort } from '../catalog-query.model';
import { countActiveFilters } from '../catalog-query.util';

let nextInstanceId = 0;

/**
 * Controles del filtro, puramente presentacionales (PROJECT_SPEC.md §4):
 * recibe `filters`/`categories`, emite `filtersChange`/`clear`. No inyecta
 * `CatalogQueryService` ni el cliente de API — `CatalogPage` es el único
 * contenedor que habla con servicios. Se monta dos veces (columna fija de
 * escritorio + panel móvil diferido), así que sus `id` internos llevan un
 * prefijo de instancia para no chocar cuando ambas copias conviven en el
 * DOM (una oculta por CSS, no eliminada).
 */
@Component({
  selector: 'app-catalog-filter-panel',
  templateUrl: './catalog-filter-panel.html',
  styleUrl: './catalog-filter-panel.css',
})
export class CatalogFilterPanel {
  readonly filters = input.required<CatalogFilters>();
  readonly categories = input<readonly CategorySummary[]>([]);

  readonly filtersChange = output<Partial<CatalogFilters>>();
  readonly clear = output<void>();

  protected readonly instanceId = `catalog-filter-panel-${nextInstanceId++}`;
  protected readonly priceErrorId = computed(() => `${this.instanceId}-price-error`);

  protected readonly activeFilterCount = computed(() => countActiveFilters(this.filters()));
  protected readonly showRelevance = computed(() => !!this.filters().q);

  /** Se resincroniza solo cuando cambia la URL, no en cada tecleo (mismo patrón que `CatalogPage.requestedPage`). */
  protected readonly searchDraft = linkedSignal(() => this.filters().q ?? '');
  /**
   * Sin `initialValue`: fijarlo desde `this.filters()` sería una lectura
   * eager de un `input.required` fuera de un cierre perezoso (NG8118).
   * `debounceTime` retrasa también la primera emisión, así que el signal
   * empieza en `undefined` hasta que pasan los primeros 300ms — el efecto
   * de más abajo lo ignora mientras tanto.
   */
  private readonly debouncedSearch: Signal<string | undefined>;

  protected readonly minPriceDraft = linkedSignal(() => this.filters().minPrice?.toString() ?? '');
  protected readonly maxPriceDraft = linkedSignal(() => this.filters().maxPrice?.toString() ?? '');
  protected readonly priceRangeError = computed(() => {
    const min = this.minPriceDraft().trim();
    const max = this.maxPriceDraft().trim();
    return min !== '' && max !== '' && Number(min) > Number(max);
  });

  constructor() {
    this.debouncedSearch = toSignal(toObservable(this.searchDraft).pipe(debounceTime(300), distinctUntilChanged()));

    // Caso 22: 5 pulsaciones rápidas producen un solo `filtersChange`. Solo
    // emite si el valor depurado difiere del ya confirmado en la URL, para
    // no navegar de más al montar con una búsqueda ya presente.
    effect(() => {
      const value = this.debouncedSearch();
      if (value === undefined) {
        return;
      }
      untracked(() => {
        const current = this.filters().q ?? '';
        const normalized = value.trim();
        if (normalized !== current) {
          this.filtersChange.emit({ q: normalized ? normalized : null });
        }
      });
    });
  }

  protected onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
  }

  protected onCategoryToggle(slug: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.filters().categories;
    const next = checked ? [...current, slug] : current.filter((value) => value !== slug);
    this.filtersChange.emit({ categories: next });
  }

  protected onMinPriceInput(event: Event): void {
    this.minPriceDraft.set((event.target as HTMLInputElement).value);
  }

  protected onMaxPriceInput(event: Event): void {
    this.maxPriceDraft.set((event.target as HTMLInputElement).value);
  }

  /** Caso 23: min > max no consulta — solo emite si el rango es válido. */
  protected onPriceCommit(): void {
    if (this.priceRangeError()) {
      return;
    }
    const min = this.minPriceDraft().trim();
    const max = this.maxPriceDraft().trim();
    this.filtersChange.emit({
      minPrice: min ? Number(min) : null,
      maxPrice: max ? Number(max) : null,
    });
  }

  protected onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as CatalogSort;
    this.filtersChange.emit({ sort: value });
  }

  protected onSaleToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.filtersChange.emit({ onSale: checked ? true : null });
  }

  protected onClear(): void {
    this.clear.emit();
  }
}
