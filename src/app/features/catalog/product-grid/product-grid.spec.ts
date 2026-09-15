import { render, screen } from '@testing-library/angular';
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
});
