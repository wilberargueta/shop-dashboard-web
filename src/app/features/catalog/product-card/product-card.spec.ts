import { render, screen } from '@testing-library/angular';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';
import { ProductCard } from './product-card';

function buildProduct(overrides: Partial<ProductCardDto> = {}): ProductCardDto {
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
    primaryImage: {
      altText: 'Frasco de aceite de lavanda',
      card: { webp: '/media/p1/card.webp', jpeg: '/media/p1/card.jpg', width: 600, height: 600 },
    },
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('shows the effective price without a discount badge when the product is not on sale', async () => {
    await render(ProductCard, { inputs: { product: buildProduct() } });

    expect(screen.getByText('25,00 US$')).toBeTruthy();
    expect(screen.queryByText(/precio anterior/i)).toBeNull();
    expect(screen.queryByText(/^-\d+%$/)).toBeNull();
  });

  it('shows list price struck through, effective price and the percentage badge when on sale', async () => {
    await render(
      ProductCard,
      { inputs: { product: buildProduct({ onSale: true, discountPercentage: 20, effectivePrice: 20 }) } },
    );

    const listPrice = screen.getByText('25,00 US$');
    expect(listPrice.tagName).toBe('S');
    expect(screen.getByText('20,00 US$')).toBeTruthy();
    expect(screen.getByText('-20%')).toBeTruthy();
    expect(screen.getByText('precio anterior')).toBeTruthy();
  });

  it('shows an out-of-stock badge and dims the image', async () => {
    const { container } = await render(ProductCard, { inputs: { product: buildProduct({ inStock: false }) } });

    expect(screen.getByText('Agotado')).toBeTruthy();
    expect(container.querySelector('.product-card--out-of-stock')).toBeTruthy();
  });

  it('shows a disabled WhatsApp button with an accessible explanation when out of stock', async () => {
    const { container } = await render(ProductCard, { inputs: { product: buildProduct({ inStock: false }) } });

    const button = screen.getByRole('button', { name: 'Consultar por WhatsApp' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);

    const describedById = button.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const reason = container.querySelector(`#${describedById}`);
    expect(reason?.textContent).toContain('Agotado');
  });

  it('does not render a WhatsApp button when the product is in stock', async () => {
    await render(ProductCard, { inputs: { product: buildProduct() } });

    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
  });

  it('falls back to the local placeholder when the product has no image', async () => {
    const { container } = await render(
      ProductCard,
      { inputs: { product: buildProduct({ primaryImage: undefined }) } },
    );

    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/images/product-placeholder.svg');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('renders a picture element with a webp source and jpeg fallback with explicit dimensions', async () => {
    const { container } = await render(ProductCard, { inputs: { product: buildProduct() } });

    const source = container.querySelector('source[type="image/webp"]');
    const img = container.querySelector('img');
    const expectedSizes = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw';

    expect(source?.getAttribute('srcset')).toBe('/media/p1/card.webp 600w');
    expect(source?.getAttribute('sizes')).toBe(expectedSizes);
    expect(img?.getAttribute('src')).toBe('/media/p1/card.jpg');
    expect(img?.getAttribute('srcset')).toBe('/media/p1/card.jpg 600w');
    expect(img?.getAttribute('sizes')).toBe(expectedSizes);
    expect(img?.getAttribute('width')).toBe('600');
    expect(img?.getAttribute('height')).toBe('600');
    expect(img?.getAttribute('alt')).toBe('Frasco de aceite de lavanda');
  });

  it('marks the first-screen image as eager and high priority when priority is set', async () => {
    const { container } = await render(
      ProductCard,
      { inputs: { product: buildProduct(), priority: true } },
    );

    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  it('marks images below the fold as lazy without fetchpriority by default', async () => {
    const { container } = await render(ProductCard, { inputs: { product: buildProduct() } });

    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.hasAttribute('fetchpriority')).toBe(false);
  });
});
