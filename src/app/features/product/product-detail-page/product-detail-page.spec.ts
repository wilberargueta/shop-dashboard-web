import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { ProductDetail } from '../../../api/model/product-detail';
import { MAX_SELECTION } from '../../../core/config/max-selection.token';
import { SITE_URL } from '../../../core/config/site-url.token';
import { ApiError } from '../../../core/http/problem-detail.model';
import { ProductDetailPage } from './product-detail-page';

const TEST_ROUTES: Routes = [{ path: 'p/:slug', component: ProductDetailPage }];

function buildProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 'p1',
    sku: 'ACE-001',
    name: 'Aceite esencial de lavanda 30ml',
    slug: 'aceite-esencial-de-lavanda-30ml',
    shortDescription: 'Relajante, 100% puro',
    price: 25,
    effectivePrice: 25,
    onSale: false,
    currency: 'USD',
    inStock: true,
    category: { slug: 'aceites', name: 'Aceites' },
    description: '<p>Relajante.</p>',
    images: [
      {
        altText: 'Frasco de aceite de lavanda',
        detail: { webp: '/media/p1/detail.webp', jpeg: '/media/p1/detail.jpg', width: 1400, height: 1400 },
      },
    ],
    ...overrides,
  };
}

describe('ProductDetailPage', () => {
  let getProduct: ReturnType<typeof vi.fn>;
  let responseInit: { status?: number };

  beforeEach(() => {
    sessionStorage.clear();
    getProduct = vi.fn();
    responseInit = {};

    TestBed.configureTestingModule({
      providers: [
        provideRouter(TEST_ROUTES, withComponentInputBinding()),
        provideLocationMocks(),
        { provide: PublicCatalogControllerService, useValue: { getProduct } },
        { provide: RESPONSE_INIT, useValue: responseInit },
        { provide: SITE_URL, useValue: 'https://tienda.test' },
        { provide: MAX_SELECTION, useValue: 20 },
      ],
    });
  });

  it('shows a skeleton while the product is loading', async () => {
    getProduct.mockReturnValue(new Subject());

    const harness = await RouterTestingHarness.create('/p/aceite-esencial-de-lavanda-30ml');

    expect(harness.routeNativeElement?.querySelector('.product-detail-skeleton')).toBeTruthy();
  });

  it('renders the product and sets title/meta tags with an absolute og:image (case 41)', async () => {
    getProduct.mockReturnValue(of(buildProduct()));

    const harness = await RouterTestingHarness.create('/p/aceite-esencial-de-lavanda-30ml');

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Aceite esencial de lavanda 30ml',
    );
    expect(document.title).toBe('Aceite esencial de lavanda 30ml');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://tienda.test/media/p1/detail.webp',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://tienda.test/p/aceite-esencial-de-lavanda-30ml',
    );
  });

  it('renders "not found" and sets a real 404 status for a nonexistent slug (case 42)', async () => {
    const apiError: ApiError = { status: 404, problem: null, retryAfterSeconds: null };
    getProduct.mockReturnValue(throwError(() => apiError));

    const harness = await RouterTestingHarness.create('/p/no-existe');

    expect(harness.routeNativeElement?.textContent).toContain('Producto no encontrado');
    expect(responseInit.status).toBe(404);
  });

  it('renders "not found" and sets a real 404 status for an unpublished (draft) product (case 43)', async () => {
    const apiError: ApiError = { status: 404, problem: null, retryAfterSeconds: null };
    getProduct.mockReturnValue(throwError(() => apiError));

    const harness = await RouterTestingHarness.create('/p/producto-en-borrador');

    expect(harness.routeNativeElement?.textContent).toContain('Producto no encontrado');
    expect(responseInit.status).toBe(404);
  });

  it('shows a generic error message without touching the response status for other failures', async () => {
    const apiError: ApiError = { status: 500, problem: null, retryAfterSeconds: null };
    getProduct.mockReturnValue(throwError(() => apiError));

    const harness = await RouterTestingHarness.create('/p/aceite-esencial-de-lavanda-30ml');

    expect(harness.routeNativeElement?.textContent).toContain('No se pudo cargar el producto');
    expect(responseInit.status).toBeUndefined();
  });

  it('W9: adding to the selection here flips the button to "Quitar de la selección"', async () => {
    getProduct.mockReturnValue(of(buildProduct()));

    const harness = await RouterTestingHarness.create('/p/aceite-esencial-de-lavanda-30ml');

    const addButton = harness.routeNativeElement?.querySelector(
      '.product-detail-content__add-button',
    ) as HTMLButtonElement;
    expect(addButton.textContent).toContain('Añadir a la selección');

    fireEvent.click(addButton);
    await harness.fixture.whenStable();

    expect(addButton.textContent).toContain('Quitar de la selección');
  });
});
