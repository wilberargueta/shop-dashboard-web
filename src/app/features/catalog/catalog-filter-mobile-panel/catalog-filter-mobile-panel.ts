import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { CategorySummary } from '../../../api/model/category-summary';
import { FocusTrap } from '../../../shared/focus-trap/focus-trap';
import { CatalogFilterPanel } from '../catalog-filter-panel/catalog-filter-panel';
import { CatalogFilters } from '../catalog-query.model';
import { countActiveFilters } from '../catalog-query.util';

/**
 * Envoltorio para <1024px (PROJECT_SPEC.md §11): botón disparador con
 * insignia, siempre presente, y detrás un `@defer (on interaction)` con el
 * fondo + panel deslizante — el JS del diálogo (fondo, `appFocusTrap`,
 * cierre) nunca se descarga para quien no lo abre (ROADMAP.md: "cargado
 * bajo demanda"; PROJECT_SPEC.md §10). No habla con servicios: reenvía
 * `filtersChange`/`clear` de `CatalogFilterPanel`, igual que este último.
 */
@Component({
  selector: 'app-catalog-filter-mobile-panel',
  imports: [CatalogFilterPanel, FocusTrap],
  templateUrl: './catalog-filter-mobile-panel.html',
  styleUrl: './catalog-filter-mobile-panel.scss',
})
export class CatalogFilterMobilePanel {
  readonly filters = input.required<CatalogFilters>();
  readonly categories = input<readonly CategorySummary[]>([]);

  readonly filtersChange = output<Partial<CatalogFilters>>();
  readonly clear = output<void>();

  protected readonly titleId = 'catalog-filter-mobile-panel-title';
  protected readonly isOpen = signal(false);
  protected readonly activeFilterCount = computed(() => countActiveFilters(this.filters()));

  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly triggerElement = computed(() => this.triggerRef()?.nativeElement ?? null);

  protected onOpen(): void {
    this.isOpen.set(true);
  }

  protected onClose(): void {
    this.isOpen.set(false);
  }

  protected onFiltersChange(patch: Partial<CatalogFilters>): void {
    this.filtersChange.emit(patch);
  }

  protected onClear(): void {
    this.clear.emit();
  }
}
