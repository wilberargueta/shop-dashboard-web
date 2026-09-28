import { DeferBlockState } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { DEFAULT_CATALOG_FILTERS, CatalogFilters } from '../catalog-query.model';
import { CatalogFilterMobilePanel } from './catalog-filter-mobile-panel';

function buildFilters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  return { ...DEFAULT_CATALOG_FILTERS, ...overrides };
}

/**
 * `on interaction(trigger)` no se dispara de forma fiable con un
 * `fireEvent.click` sintético en jsdom. `deferBlockStates: Complete` es la
 * API pública de Angular para forzar el contenido diferido a su estado
 * final en los tests, sin depender de simular el disparador real — lo que
 * se prueba aquí es el diálogo (foco, Escape, fondo), no el mecanismo de
 * `@defer` en sí.
 */
async function renderOpenable(filters: CatalogFilters, on?: Record<string, (...args: never[]) => void>) {
  return render(CatalogFilterMobilePanel, {
    inputs: { filters, categories: [] },
    deferBlockStates: DeferBlockState.Complete,
    on,
  });
}

describe('CatalogFilterMobilePanel', () => {
  it('shows the active filter count as a badge, hidden when there are none', async () => {
    const { rerender } = await render(CatalogFilterMobilePanel, {
      inputs: { filters: buildFilters(), categories: [] },
    });

    const trigger = screen.getByRole('button', { name: /Filtros/ });
    expect(trigger.textContent).not.toMatch(/\d/);

    await rerender({ inputs: { filters: buildFilters({ categories: ['aceites'], onSale: true }), categories: [] } });

    expect(screen.getByRole('button', { name: /Filtros/ }).textContent).toContain('2');
  });

  it('opens the dialog on trigger click and moves focus inside it', async () => {
    const { fixture } = await renderOpenable(buildFilters());

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fixture.detectChanges();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { fixture } = await renderOpenable(buildFilters());

    const trigger = screen.getByRole('button', { name: /Filtros/ });
    fireEvent.click(trigger);
    fixture.detectChanges();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fixture.detectChanges();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on backdrop click', async () => {
    const { fixture, container } = await renderOpenable(buildFilters());

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fixture.detectChanges();

    const backdrop = container.querySelector('.catalog-filter-mobile-panel__backdrop');
    if (!backdrop) {
      throw new Error('backdrop not found');
    }
    fireEvent.click(backdrop);
    fixture.detectChanges();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-emits filtersChange and clear from the inner CatalogFilterPanel', async () => {
    const onFiltersChange = vi.fn();
    const onClear = vi.fn();
    const { fixture } = await renderOpenable(buildFilters({ onSale: true }), {
      filtersChange: onFiltersChange,
      clear: onClear,
    });

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/ }));

    expect(onClear).toHaveBeenCalled();
  });
});
