import { ProductDetail } from '../../api/model/product-detail';
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  resolveAbsoluteDetailImage,
} from './seo.schema';

describe('resolveAbsoluteDetailImage', () => {
  it('prefers webp over jpeg for the first image', () => {
    const url = resolveAbsoluteDetailImage('https://tienda.test', [
      { detail: { webp: '/media/a/detail.webp', jpeg: '/media/a/detail.jpg', width: 1400, height: 1400 } },
    ]);
    expect(url).toBe('https://tienda.test/media/a/detail.webp');
  });

  it('falls back to jpeg without webp', () => {
    const url = resolveAbsoluteDetailImage('https://tienda.test', [
      { detail: { jpeg: '/media/a/detail.jpg', width: 1400, height: 1400 } },
    ]);
    expect(url).toBe('https://tienda.test/media/a/detail.jpg');
  });

  it('returns undefined without any image', () => {
    expect(resolveAbsoluteDetailImage('https://tienda.test', undefined)).toBeUndefined();
    expect(resolveAbsoluteDetailImage('https://tienda.test', [])).toBeUndefined();
  });
});

describe('buildProductJsonLd', () => {
  function buildProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
    return {
      name: 'Aceite esencial de lavanda 30ml',
      shortDescription: 'Relajante, 100% puro',
      sku: 'ACE-001',
      price: 25,
      effectivePrice: 20,
      currency: 'USD',
      inStock: true,
      ...overrides,
    };
  }

  it('maps the product fields and marks it in stock', () => {
    const json = buildProductJsonLd({
      siteUrl: 'https://tienda.test',
      storeName: 'Mi Tienda',
      url: 'https://tienda.test/p/aceite-esencial-de-lavanda-30ml',
      product: buildProduct(),
    });

    expect(json).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Aceite esencial de lavanda 30ml',
      description: 'Relajante, 100% puro',
      sku: 'ACE-001',
      brand: { '@type': 'Brand', name: 'Mi Tienda' },
      offers: {
        '@type': 'Offer',
        url: 'https://tienda.test/p/aceite-esencial-de-lavanda-30ml',
        priceCurrency: 'USD',
        price: 20,
        availability: 'https://schema.org/InStock',
      },
    });
  });

  it('uses the effective price, not the list price', () => {
    const json = buildProductJsonLd({
      siteUrl: 'https://tienda.test',
      storeName: 'Mi Tienda',
      url: 'https://tienda.test/p/x',
      product: buildProduct({ price: 25, effectivePrice: 20 }),
    });

    expect((json['offers'] as Record<string, unknown>)['price']).toBe(20);
  });

  it('falls back to the list price without an effective price', () => {
    const json = buildProductJsonLd({
      siteUrl: 'https://tienda.test',
      storeName: 'Mi Tienda',
      url: 'https://tienda.test/p/x',
      product: buildProduct({ price: 25, effectivePrice: undefined }),
    });

    expect((json['offers'] as Record<string, unknown>)['price']).toBe(25);
  });

  it('marks out-of-stock products', () => {
    const json = buildProductJsonLd({
      siteUrl: 'https://tienda.test',
      storeName: 'Mi Tienda',
      url: 'https://tienda.test/p/x',
      product: buildProduct({ inStock: false }),
    });

    expect((json['offers'] as Record<string, unknown>)['availability']).toBe('https://schema.org/OutOfStock');
  });

  it('omits image entirely without any product image', () => {
    const json = buildProductJsonLd({
      siteUrl: 'https://tienda.test',
      storeName: 'Mi Tienda',
      url: 'https://tienda.test/p/x',
      product: buildProduct({ images: undefined }),
    });

    expect(json['image']).toBeUndefined();
  });

  it('includes an absolute detail image when the product has one', () => {
    const json = buildProductJsonLd({
      siteUrl: 'https://tienda.test',
      storeName: 'Mi Tienda',
      url: 'https://tienda.test/p/x',
      product: buildProduct({
        images: [{ detail: { webp: '/media/x/detail.webp', jpeg: '/media/x/detail.jpg', width: 1400, height: 1400 } }],
      }),
    });

    expect(json['image']).toEqual(['https://tienda.test/media/x/detail.webp']);
  });
});

describe('buildItemListJsonLd', () => {
  it('maps products to 1-based positioned list items', () => {
    const json = buildItemListJsonLd({
      siteUrl: 'https://tienda.test',
      products: [
        { slug: 'a', name: 'Producto A' },
        { slug: 'b', name: 'Producto B' },
      ],
    });

    expect(json).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, url: 'https://tienda.test/p/a', name: 'Producto A' },
        { '@type': 'ListItem', position: 2, url: 'https://tienda.test/p/b', name: 'Producto B' },
      ],
    });
  });

  it('produces an empty list without products', () => {
    const json = buildItemListJsonLd({ siteUrl: 'https://tienda.test', products: [] });
    expect((json['itemListElement'] as unknown[]).length).toBe(0);
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('has a single "Inicio" level', () => {
    expect(buildBreadcrumbJsonLd('https://tienda.test')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://tienda.test/' }],
    });
  });
});

describe('buildOrganizationJsonLd', () => {
  it('maps store name and site url without a logo', () => {
    const json = buildOrganizationJsonLd({ siteUrl: 'https://tienda.test', storeName: 'Mi Tienda' });
    expect(json).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Mi Tienda',
      url: 'https://tienda.test',
    });
    expect(json['logo']).toBeUndefined();
  });
});
