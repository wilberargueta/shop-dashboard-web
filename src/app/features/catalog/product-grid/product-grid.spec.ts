import { render, screen, fireEvent } from '@testing-library/angular';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';
import { ProductGrid } from './product-grid';

function buildProducts(count: number): ProductCardDto[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Producto ${i}`,
    slug: `producto-${i}`,
    price: 10,
    effectivePrice: 10,
    onSale: false,
    currency: 'USD',
    inStock: true,
  }));
}

describe('ProductGrid', () => {
  it('renders a semantic list with one item per product', async () => {
    const { container } = await render(ProductGrid, { inputs: { products: buildProducts(3) } });

    expect(screen.getByRole('list')).toBeTruthy();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('marks only the first six cards as priority images', async () => {
    const { container } = await render(ProductGrid, { inputs: { products: buildProducts(8) } });

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(8);
    images.forEach((img, index) => {
      if (index < 6) {
        expect(img.getAttribute('loading')).toBe('eager');
        expect(img.getAttribute('fetchpriority')).toBe('high');
      } else {
        expect(img.getAttribute('loading')).toBe('lazy');
        expect(img.hasAttribute('fetchpriority')).toBe(false);
      }
    });
  });

  it('shows skeleton cards while loading the first batch', async () => {
    const { container } = await render(
      ProductGrid,
      { inputs: { products: [], loading: true, skeletonCount: 4 } },
    );

    expect(container.querySelectorAll('app-skeleton-card')).toHaveLength(4);
    expect(container.querySelectorAll('app-product-card')).toHaveLength(0);
  });

  it('never shows skeletons once real products are present, even if loading is true', async () => {
    const { container } = await render(
      ProductGrid,
      { inputs: { products: buildProducts(2), loading: true } },
    );

    expect(container.querySelectorAll('app-skeleton-card')).toHaveLength(0);
    expect(container.querySelectorAll('app-product-card')).toHaveLength(2);
  });

  it('appends trailing skeleton cards after the real products while loading the next batch', async () => {
    const { container } = await render(
      ProductGrid,
      { inputs: { products: buildProducts(2), loadingMore: true } },
    );

    expect(container.querySelectorAll('app-product-card')).toHaveLength(2);
    expect(container.querySelectorAll('app-skeleton-card').length).toBeGreaterThan(0);
  });

  it('forwards a card open event as productOpen, unchanged', async () => {
    const { container, fixture } = await render(ProductGrid, { inputs: { products: buildProducts(2) } });
    const openSpy = vi.fn();
    fixture.componentInstance.productOpen.subscribe(openSpy);

    const link = container.querySelectorAll('.product-card__link')[1] as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(openSpy).toHaveBeenCalledWith({ slug: 'producto-1', origin: link });
  });

  it('marks a card as selected when its id is in selectedProductIds, and forwards its selectionToggle', async () => {
    const { fixture } = await render(ProductGrid, {
      inputs: { products: buildProducts(2), selectedProductIds: new Set(['p1']) },
    });
    const toggleSpy = vi.fn();
    fixture.componentInstance.selectionToggle.subscribe(toggleSpy);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].getAttribute('aria-checked')).toBe('false');
    expect(checkboxes[1].getAttribute('aria-checked')).toBe('true');

    fireEvent.click(checkboxes[1]);
    expect(toggleSpy).toHaveBeenCalledWith(buildProducts(2)[1]);
  });

  it('disables selection on non-selected cards when the cap is reached, but not on already-selected ones', async () => {
    await render(ProductGrid, {
      inputs: { products: buildProducts(2), selectedProductIds: new Set(['p0']), selectionCapReached: true },
    });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].getAttribute('aria-disabled')).toBeNull();
    expect(checkboxes[1].getAttribute('aria-disabled')).toBe('true');
  });
});
