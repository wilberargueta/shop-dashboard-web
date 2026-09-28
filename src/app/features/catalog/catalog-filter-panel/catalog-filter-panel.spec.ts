import { render, screen, fireEvent } from '@testing-library/angular';
import { CategorySummary } from '../../../api/model/category-summary';
import { DEFAULT_CATALOG_FILTERS, CatalogFilters } from '../catalog-query.model';
import { CatalogFilterPanel } from './catalog-filter-panel';

function buildFilters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  return { ...DEFAULT_CATALOG_FILTERS, ...overrides };
}

const CATEGORIES: CategorySummary[] = [
  { slug: 'aceites', name: 'Aceites', productCount: 12 },
  { slug: 'cremas', name: 'Cremas', productCount: 5 },
];

describe('CatalogFilterPanel', () => {
  it('reflects filters already present in the URL on first render', async () => {
    await render(CatalogFilterPanel, {
      inputs: {
        filters: buildFilters({ q: 'lavanda', categories: ['aceites'], minPrice: 10, maxPrice: 50, sort: 'newest' }),
        categories: CATEGORIES,
      },
    });

    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('lavanda');
    expect((screen.getByLabelText('Mínimo') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Máximo') as HTMLInputElement).value).toBe('50');
    expect((screen.getByRole('checkbox', { name: /Aceites/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Cremas/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('combobox', { name: 'Ordenar por' }) as HTMLSelectElement).value).toBe('newest');
  });

  it('emits the updated category array (OR) when a checkbox is toggled', async () => {
    const onFiltersChange = vi.fn();
    await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters({ categories: ['aceites'] }), categories: CATEGORIES },
      on: { filtersChange: onFiltersChange },
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /Cremas/ }));

    expect(onFiltersChange).toHaveBeenCalledWith({ categories: ['aceites', 'cremas'] });
  });

  it('debounces the search: 5 rapid keystrokes produce a single filtersChange (case 22)', async () => {
    vi.useFakeTimers();
    try {
      const onFiltersChange = vi.fn();
      const { fixture } = await render(CatalogFilterPanel, {
        inputs: { filters: buildFilters(), categories: [] },
        on: { filtersChange: onFiltersChange },
      });

      const input = screen.getByLabelText('Buscar');
      for (const letter of ['l', 'la', 'lav', 'lave', 'laven']) {
        fireEvent.input(input, { target: { value: letter } });
      }
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(300);
      fixture.detectChanges();

      expect(onFiltersChange).toHaveBeenCalledTimes(1);
      expect(onFiltersChange).toHaveBeenCalledWith({ q: 'laven' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an error and does not emit when minPrice > maxPrice (case 23)', async () => {
    const onFiltersChange = vi.fn();
    await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters(), categories: [] },
      on: { filtersChange: onFiltersChange },
    });

    fireEvent.input(screen.getByLabelText('Mínimo'), { target: { value: '50' } });
    fireEvent.input(screen.getByLabelText('Máximo'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Máximo'));

    expect(screen.getByRole('alert').textContent).toContain('El precio mínimo no puede ser mayor que el máximo.');
    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it('emits minPrice/maxPrice only on commit (change), with a valid range', async () => {
    const onFiltersChange = vi.fn();
    await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters(), categories: [] },
      on: { filtersChange: onFiltersChange },
    });

    fireEvent.input(screen.getByLabelText('Mínimo'), { target: { value: '10' } });
    expect(onFiltersChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Mínimo'));

    expect(onFiltersChange).toHaveBeenCalledWith({ minPrice: 10, maxPrice: null });
  });

  it('only offers "Relevancia" when there is an active search', async () => {
    const { rerender } = await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters(), categories: [] },
    });

    expect(screen.queryByRole('option', { name: 'Relevancia' })).toBeNull();

    await rerender({ inputs: { filters: buildFilters({ q: 'lavanda' }), categories: [] } });

    expect(screen.getByRole('option', { name: 'Relevancia' })).toBeTruthy();
  });

  it('emits the sort change', async () => {
    const onFiltersChange = vi.fn();
    await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters(), categories: [] },
      on: { filtersChange: onFiltersChange },
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), { target: { value: 'price,asc' } });

    expect(onFiltersChange).toHaveBeenCalledWith({ sort: 'price,asc' });
  });

  it('emits onSale: true when checked and null when unchecked', async () => {
    const onFiltersChange = vi.fn();
    await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters(), categories: [] },
      on: { filtersChange: onFiltersChange },
    });

    const toggle = screen.getByRole('checkbox', { name: 'Solo ofertas' });
    fireEvent.click(toggle);
    expect(onFiltersChange).toHaveBeenLastCalledWith({ onSale: true });

    fireEvent.click(toggle);
    expect(onFiltersChange).toHaveBeenLastCalledWith({ onSale: null });
  });

  it('hides "Limpiar filtros" when nothing is active, and shows the count otherwise', async () => {
    const { rerender } = await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters(), categories: [] },
    });

    expect(screen.queryByRole('button', { name: /Limpiar filtros/ })).toBeNull();

    await rerender({ inputs: { filters: buildFilters({ categories: ['aceites'], onSale: true }), categories: [] } });

    expect(screen.getByRole('button', { name: /Limpiar filtros/ }).textContent).toContain('(2)');
  });

  it('emits clear when the button is clicked', async () => {
    const onClear = vi.fn();
    await render(CatalogFilterPanel, {
      inputs: { filters: buildFilters({ onSale: true }), categories: [] },
      on: { clear: onClear },
    });

    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/ }));

    expect(onClear).toHaveBeenCalled();
  });
});
