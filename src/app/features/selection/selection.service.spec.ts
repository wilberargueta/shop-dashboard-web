import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PublicCatalogControllerService } from '../../api/api/public-catalog-controller.service';
import { ProductCard as ProductCardDto } from '../../api/model/product-card';
import { ProductDetail } from '../../api/model/product-detail';
import { ApiError } from '../../core/http/problem-detail.model';
import { MAX_SELECTION } from '../../core/config/max-selection.token';
import { SelectionService } from './selection.service';

const STORAGE_KEY = 'shop.selection';

function buildProduct(overrides: Partial<ProductCardDto> = {}): ProductCardDto {
  return {
    id: 'p1',
    sku: 'ACE-001',
    name: 'Aceite esencial de lavanda 30ml',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 20,
    onSale: true,
    discountPercentage: 20,
    currency: 'USD',
    inStock: true,
    category: { slug: 'aceites', name: 'Aceites' },
    ...overrides,
  };
}

function buildDetail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return { ...buildProduct(), description: '', images: [], ...overrides };
}

describe('SelectionService', () => {
  let getProduct: ReturnType<typeof vi.fn>;

  function configure(maxSelection = 20, platform: 'browser' | 'server' = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicCatalogControllerService, useValue: { getProduct } },
        { provide: MAX_SELECTION, useValue: maxSelection },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
  }

  beforeEach(() => {
    sessionStorage.clear();
    getProduct = vi.fn();
  });

  it('case 26: toggling a product adds it, updates count/subtotal, and toggling again removes it', () => {
    configure();
    const service = TestBed.inject(SelectionService);

    service.toggle(buildProduct());
    expect(service.count()).toBe(1);
    expect(service.subtotal()).toBe(20);

    service.toggle(buildProduct());
    expect(service.count()).toBe(0);
    expect(service.subtotal()).toBe(0);
  });

  it('case 27: changing the quantity recalculates the subtotal', () => {
    configure();
    const service = TestBed.inject(SelectionService);
    service.add(buildProduct());

    service.setQuantity('p1', 3);

    expect(service.subtotal()).toBe(60);
    expect(service.totalUnits()).toBe(3);
  });

  it('case 28: the selection survives a reload (a fresh service instance restores it)', async () => {
    configure();
    const service = TestBed.inject(SelectionService);
    service.add(buildProduct(), 2);
    TestBed.tick(); // el `effect()` de persistencia no flushea solo sin una vista real

    expect(sessionStorage.getItem(STORAGE_KEY)).toContain('"cantidad":2');

    getProduct.mockReturnValue(of(buildDetail()));
    TestBed.resetTestingModule();
    configure();
    const reloaded = TestBed.inject(SelectionService);
    await Promise.resolve();

    expect(reloaded.count()).toBe(1);
    expect(reloaded.lines()[0].quantity).toBe(2);
  });

  it('case 29 (crítico): restoring refreshes prices from the API, not from sessionStorage', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ productId: 'p1', slug: 'aceite-esencial-de-lavanda-30ml', cantidad: 1 }]),
    );
    // El precio en el storage no existe (nunca se guarda); el mock devuelve
    // un precio distinto a cualquier valor implícito para probar que la
    // línea restaurada viene de la API, no de una suposición local.
    getProduct.mockReturnValue(of(buildDetail({ price: 99, effectivePrice: 77, onSale: true, discountPercentage: 22 })));
    configure();

    const service = TestBed.inject(SelectionService);
    await Promise.resolve();

    expect(getProduct).toHaveBeenCalledTimes(1);
    expect(getProduct).toHaveBeenCalledWith({ slug: 'aceite-esencial-de-lavanda-30ml' });
    expect(service.lines()[0].effectivePrice).toBe(77);
    expect(service.lines()[0].price).toBe(99);
  });

  it('case 30: a line whose product returns 404 (unpublished) is dropped, the rest survive', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { productId: 'p1', slug: 'sigue-publicado', cantidad: 1 },
        { productId: 'p2', slug: 'ya-no-publicado', cantidad: 1 },
      ]),
    );
    const notFound: ApiError = { status: 404, problem: null, retryAfterSeconds: null };
    getProduct.mockImplementation(({ slug }: { slug: string }) =>
      slug === 'sigue-publicado' ? of(buildDetail({ id: 'p1', slug })) : throwError(() => notFound),
    );
    configure();

    const service = TestBed.inject(SelectionService);
    await Promise.resolve();

    expect(service.count()).toBe(1);
    expect(service.lines()[0].productId).toBe('p1');
  });

  it('case 30 (variante): cualquier fallo al refrescar descarta la línea, no solo un 404', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ productId: 'p1', slug: 'falla-de-red', cantidad: 1 }]),
    );
    const serverError: ApiError = { status: 500, problem: null, retryAfterSeconds: null };
    getProduct.mockReturnValue(throwError(() => serverError));
    configure();

    const service = TestBed.inject(SelectionService);
    await Promise.resolve();

    expect(service.count()).toBe(0);
  });

  it('case 31: add() respects catalog.max_selection and reports capReached', () => {
    configure(2);
    const service = TestBed.inject(SelectionService);

    expect(service.add(buildProduct({ id: 'p1', slug: 'a' }))).toBe(true);
    expect(service.add(buildProduct({ id: 'p2', slug: 'b' }))).toBe(true);
    expect(service.capReached()).toBe(true);

    expect(service.add(buildProduct({ id: 'p3', slug: 'c' }))).toBe(false);
    expect(service.count()).toBe(2);
  });

  it('case 31: bumping the quantity of an already-selected product never counts against the cap', () => {
    configure(1);
    const service = TestBed.inject(SelectionService);
    service.add(buildProduct());

    expect(service.add(buildProduct(), 2)).toBe(true);
    expect(service.count()).toBe(1);
    expect(service.lines()[0].quantity).toBe(3);
  });

  it('case 31 (restore): only the first max_selection stored lines are fetched and restored', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { productId: 'p1', slug: 'uno', cantidad: 1 },
        { productId: 'p2', slug: 'dos', cantidad: 1 },
        { productId: 'p3', slug: 'tres', cantidad: 1 },
      ]),
    );
    getProduct.mockImplementation(({ slug }: { slug: string }) => of(buildDetail({ slug })));
    configure(2);

    const service = TestBed.inject(SelectionService);
    await Promise.resolve();

    expect(getProduct).toHaveBeenCalledTimes(2);
    expect(service.count()).toBe(2);
  });

  it('the server does not crash without sessionStorage and never calls the API to restore', () => {
    configure(20, 'server');
    const service = TestBed.inject(SelectionService);

    expect(service.lines()).toEqual([]);
    expect(service.count()).toBe(0);
    expect(getProduct).not.toHaveBeenCalled();
  });
});
