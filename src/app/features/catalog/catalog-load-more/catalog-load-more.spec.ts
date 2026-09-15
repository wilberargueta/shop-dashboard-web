import { render, screen } from '@testing-library/angular';
import { CatalogLoadMore } from './catalog-load-more';

describe('CatalogLoadMore', () => {
  it('shows an accessible "Cargar más" button while there are more products', async () => {
    await render(CatalogLoadMore, { inputs: { hasNext: true } });

    expect(screen.getByRole('button', { name: 'Cargar más' })).toBeTruthy();
  });

  it('announces that it is loading more products', async () => {
    await render(CatalogLoadMore, { inputs: { hasNext: true, loading: true } });

    expect(screen.getByText('Cargando más productos…')).toBeTruthy();
  });

  it('announces the running count in the aria-live region once a batch is ready, so a new batch gets announced', async () => {
    const { rerender } = await render(CatalogLoadMore, { inputs: { hasNext: true, count: 3 } });

    expect(screen.getByText('Mostrando 3 productos.')).toBeTruthy();

    await rerender({ inputs: { hasNext: true, count: 6 } });

    expect(screen.getByText('Mostrando 6 productos.')).toBeTruthy();
  });

  it('shows a retry button and announces the error when a batch fails', async () => {
    await render(CatalogLoadMore, { inputs: { hasNext: true, hasError: true } });

    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.getByText('No se pudieron cargar más productos.')).toBeTruthy();
  });

  it('shows the end-of-list message and no button once there is nothing left to load', async () => {
    const { container } = await render(CatalogLoadMore, { inputs: { hasNext: false } });

    expect(screen.getByText('No hay más productos.')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
  });

  it('emits loadMore when the fallback button is activated', async () => {
    const loadMore = vi.fn();
    await render(CatalogLoadMore, { inputs: { hasNext: true }, on: { loadMore } });

    screen.getByRole('button', { name: 'Cargar más' }).click();

    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
