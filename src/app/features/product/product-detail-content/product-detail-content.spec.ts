import { render, screen } from '@testing-library/angular';
import { ProductDetail } from '../../../api/model/product-detail';
import { ProductDetailContent } from './product-detail-content';

function buildProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 'p1',
    sku: 'ACE-001',
    name: 'Aceite esencial de lavanda 30ml',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 25,
    onSale: false,
    discountPercentage: undefined,
    currency: 'USD',
    inStock: true,
    category: { slug: 'aceites', name: 'Aceites' },
    description: '<p>Relajante, 100% puro.</p>',
    usageInstructions: undefined,
    images: [
      {
        altText: 'Frasco de aceite de lavanda',
        detail: { webp: '/media/p1/detail.webp', jpeg: '/media/p1/detail.jpg', width: 1400, height: 1400 },
      },
    ],
    ...overrides,
  };
}

describe('ProductDetailContent', () => {
  it('shows name, SKU, price and availability', async () => {
    await render(ProductDetailContent, { inputs: { product: buildProduct() } });

    expect(screen.getByRole('heading', { name: 'Aceite esencial de lavanda 30ml' })).toBeTruthy();
    expect(screen.getByText('ACE-001', { exact: false })).toBeTruthy();
    expect(screen.getByText('25,00 US$')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
  });

  it('shows "Agotado" and disables the quantity stepper when out of stock', async () => {
    await render(ProductDetailContent, { inputs: { product: buildProduct({ inStock: false }) } });

    expect(screen.getByText('Agotado')).toBeTruthy();
    expect(screen.getByRole('spinbutton').getAttribute('aria-disabled')).toBe('true');
  });

  it('does not render the usage instructions section when there are none (case 37)', async () => {
    await render(ProductDetailContent, { inputs: { product: buildProduct({ usageInstructions: undefined }) } });

    expect(screen.queryByText('Instrucciones de uso')).toBeNull();
  });

  it('renders the usage instructions section when present', async () => {
    await render(
      ProductDetailContent,
      { inputs: { product: buildProduct({ usageInstructions: '<p>Aplicar en las sienes.</p>' }) } },
    );

    expect(screen.getByText('Instrucciones de uso')).toBeTruthy();
    expect(screen.getByText('Aplicar en las sienes.')).toBeTruthy();
  });

  it('sanitizes the description binding, never executing embedded scripts', async () => {
    const { container } = await render(
      ProductDetailContent,
      { inputs: { product: buildProduct({ description: '<p>Hola</p><script>window.__xss = true;</script>' }) } },
    );

    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it('falls back to the local placeholder when the product has no images', async () => {
    const { container } = await render(ProductDetailContent, { inputs: { product: buildProduct({ images: [] }) } });

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/product-placeholder.svg');
  });
});
