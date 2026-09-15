import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { PageResponseProductCard } from '../../../api/model/page-response-product-card';
import { CatalogPage } from './catalog-page';

const TEST_ROUTES: Routes = [{ path: '**', component: CatalogPage }];

function buildResponse(page: number, count: number, hasNext: boolean): PageResponseProductCard {
  return {
    content: Array.from({ length: count }, (_, i) => ({
      id: `p${page}-${i}`,
      name: `Producto ${page}-${i}`,
      price: 10,
      effectivePrice: 10,
      onSale: false,
      currency: 'USD',
      inStock: true,
    })),
    page,
    size: count,
    totalElements: count * (page + 1),
    totalPages: page + 1,
    hasNext,
  };
}

function loadMoreButton(harness: RouterTestingHarness): HTMLButtonElement {
  const button = harness.routeNativeElement?.querySelector('.catalog-load-more__button');
  if (!button) {
    throw new Error('load more button not found');
  }
  return button as HTMLButtonElement;
}

describe('CatalogPage', () => {
  let listProducts: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listProducts = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideRouter(TEST_ROUTES),
        provideLocationMocks(),
        { provide: PublicCatalogControllerService, useValue: { listProducts } },
      ],
    });
  });

  /**
   * `RouterTestingHarness.create()` ya navega y monta `CatalogPage`, así que
   * la respuesta encolada en `listProducts` antes de llamarla es la que
   * resuelve la carga inicial (página 0) — no hace falta un `navigateByUrl`
   * extra a la misma URL, que no dispararía una petición nueva.
   */
  async function createHarness(url = '/'): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create(url);
    TestBed.inject(Router).setUpLocationChangeListener();
    return harness;
  }

  it('derives the request params from the URL filters, always starting at page 0', async () => {
    listProducts.mockReturnValue(of(buildResponse(0, 3, true)));

    const harness = await createHarness('/?category=aceites&sort=newest');
    await harness.fixture.whenStable();

    expect(listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, sort: 'newest', category: ['aceites'] }),
    );
  });

  it('omits sort when it is the default "featured" — the backend rejects that value explicitly (ARQUITECTURA.md §5.1)', async () => {
    listProducts.mockReturnValue(of(buildResponse(0, 3, true)));

    const harness = await createHarness('/?sort=featured');
    await harness.fixture.whenStable();

    expect(listProducts.mock.calls[0][0]).not.toHaveProperty('sort');
  });

  it('also omits sort with no sort param at all in the URL (same default)', async () => {
    listProducts.mockReturnValue(of(buildResponse(0, 3, true)));

    const harness = await createHarness('/');
    await harness.fixture.whenStable();

    expect(listProducts.mock.calls[0][0]).not.toHaveProperty('sort');
  });

  it('renders the products returned by the resolved resource in the grid', async () => {
    listProducts.mockReturnValue(of(buildResponse(0, 3, true)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(3);
  });

  it('case 13: reaching the sentinel requests the next page and appends it to the grid', async () => {
    listProducts.mockReturnValueOnce(of(buildResponse(0, 3, true)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    listProducts.mockReturnValueOnce(of(buildResponse(1, 3, false)));
    fireEvent.click(loadMoreButton(harness));
    await harness.fixture.whenStable();

    expect(listProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(6);
  });

  it('case 14: shows the loading indicator while the next batch is in flight', async () => {
    listProducts.mockReturnValueOnce(of(buildResponse(0, 3, true)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    const nextPage = new Subject<PageResponseProductCard>();
    listProducts.mockReturnValueOnce(nextPage);
    fireEvent.click(loadMoreButton(harness));
    harness.fixture.detectChanges();

    // Sigue en vuelo (el Subject no ha emitido todavía): tarjetas esqueleto
    // añadidas al final de la lista y el anuncio de carga, sin duplicar las
    // 3 tarjetas reales que ya había.
    expect(harness.routeNativeElement?.querySelectorAll('app-skeleton-card').length).toBeGreaterThan(0);
    expect(harness.routeNativeElement?.textContent).toContain('Cargando más productos');
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(3);

    nextPage.next(buildResponse(1, 3, false));
    nextPage.complete();
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelectorAll('app-skeleton-card')).toHaveLength(0);
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(6);
  });

  it('case 15: does not fire a second request while one is already in flight', async () => {
    listProducts.mockReturnValueOnce(of(buildResponse(0, 3, true)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    listProducts.mockReturnValueOnce(of(buildResponse(1, 3, false)));
    const button = loadMoreButton(harness);
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await harness.fixture.whenStable();

    // La página 0 inicial + una sola petición para la página 1.
    expect(listProducts).toHaveBeenCalledTimes(2);
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(6);
  });

  it('case 16: hasNext false shows the end-of-list message and stops requesting', async () => {
    listProducts.mockReturnValueOnce(of(buildResponse(0, 3, false)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.textContent).toContain('No hay más productos');
    expect(harness.routeNativeElement?.querySelector('.catalog-load-more__button')).toBeNull();
  });

  it('case 17: a failed batch shows a retry affordance, and retrying recovers', async () => {
    listProducts.mockReturnValueOnce(of(buildResponse(0, 3, true)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    listProducts.mockReturnValueOnce(
      throwError(() => ({ status: 500, problem: null, retryAfterSeconds: null })),
    );
    const button = loadMoreButton(harness);
    fireEvent.click(button);
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.textContent).toContain('No se pudieron cargar más productos');
    expect(button.textContent).toContain('Reintentar');
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(3);

    listProducts.mockReturnValueOnce(of(buildResponse(1, 3, false)));
    fireEvent.click(button);
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(6);
  });

  it('case 18: changing a filter resets the accumulated list and scrolls to the top', async () => {
    listProducts.mockReturnValueOnce(of(buildResponse(0, 3, true)));

    const harness = await createHarness();
    await harness.fixture.whenStable();

    listProducts.mockReturnValueOnce(of(buildResponse(1, 3, false)));
    fireEvent.click(loadMoreButton(harness));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(6);

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    listProducts.mockReturnValueOnce(of(buildResponse(0, 2, false)));

    await harness.navigateByUrl('/?category=aceites');
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(2);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0 });
  });
});
