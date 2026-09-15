import { Injectable, Signal, computed, inject } from '@angular/core';
import { Params, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogFilters, CatalogPage } from './catalog-query.model';
import { parseCatalogFilters, parseCatalogPage } from './catalog-query.util';

/**
 * Estado de navegación del catálogo, leído y escrito desde los parámetros de
 * la URL (PROJECT_SPEC.md §4: la URL es la fuente de verdad). Depende
 * únicamente de `Router`, nunca de `window`/`document`/`localStorage`, así
 * que funciona igual en servidor y en cliente sin ninguna guarda de
 * plataforma.
 */
@Injectable({
  providedIn: 'root',
})
export class CatalogQueryService {
  private readonly router = inject(Router);

  private readonly queryParamMap = toSignal(this.router.routerState.root.queryParamMap, {
    requireSync: true,
  });

  readonly filters: Signal<CatalogFilters> = computed(() => parseCatalogFilters(this.queryParamMap()));
  readonly page: Signal<CatalogPage> = computed(() => parseCatalogPage(this.queryParamMap()));

  /**
   * Aplica cambios parciales de filtros. Una clave ausente del patch no se
   * toca; una clave con `null` explícito borra ese parámetro de la URL.
   * Siempre reinicia `page` (PROJECT_SPEC.md §3.8).
   */
  updateFilters(patch: Partial<CatalogFilters>): void {
    const queryParams = this.toQueryParams(patch);
    queryParams['page'] = null;
    this.navigate(queryParams, 'merge');
  }

  /** Cambia solo la página, sin tocar el resto de filtros. */
  setPage(page: number): void {
    this.navigate({ page: page === 0 ? null : String(page) }, 'merge');
  }

  /** Deja la URL sin ningún parámetro de catálogo. */
  clearFilters(): void {
    this.navigate({}, '');
  }

  private toQueryParams(patch: Partial<CatalogFilters>): Params {
    const params: Params = {};

    if ('q' in patch) {
      params['q'] = patch.q ? patch.q : null;
    }
    if ('categories' in patch) {
      params['category'] = patch.categories && patch.categories.length > 0 ? [...patch.categories] : null;
    }
    if ('minPrice' in patch) {
      params['minPrice'] = patch.minPrice === null || patch.minPrice === undefined ? null : String(patch.minPrice);
    }
    if ('maxPrice' in patch) {
      params['maxPrice'] = patch.maxPrice === null || patch.maxPrice === undefined ? null : String(patch.maxPrice);
    }
    if ('onSale' in patch) {
      params['onSale'] = patch.onSale === null || patch.onSale === undefined ? null : String(patch.onSale);
    }
    if ('inStock' in patch) {
      params['inStock'] = patch.inStock === null || patch.inStock === undefined ? null : String(patch.inStock);
    }
    if ('sort' in patch) {
      params['sort'] = patch.sort ?? null;
    }

    return params;
  }

  private navigate(queryParams: Params, queryParamsHandling: 'merge' | ''): void {
    void this.router.navigate([], {
      relativeTo: this.router.routerState.root,
      queryParams,
      queryParamsHandling,
    });
  }
}
