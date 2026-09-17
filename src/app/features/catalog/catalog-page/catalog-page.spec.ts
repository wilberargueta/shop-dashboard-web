import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { PageResponseProductCard } from '../../../api/model/page-response-product-card';
import { MAX_SELECTION } from '../../../core/config/max-selection.token';
import { SITE_URL } from '../../../core/config/site-url.token';
import { WHATSAPP_SETTINGS, WhatsAppSettings } from '../../../core/config/whatsapp-settings.token';
import { WhatsAppPreviewService } from '../../selection/whatsapp-preview/whatsapp-preview.service';
import { CatalogPage } from './catalog-page';

const TEST_ROUTES: Routes = [{ path: '**', component: CatalogPage }];

const WHATSAPP_SETTINGS_VALUE: WhatsAppSettings = {
  phoneNumber: '50370000000',
  storeName: 'Mi Tienda',
  templates: { single: '{{producto}}', multiHeader: '', multiItem: '', multiFooter: '' },
};

function buildResponse(page: number, count: number, hasNext: boolean): PageResponseProductCard {
  return {
    content: Array.from({ length: count }, (_, i) => ({
      id: `p${page}-${i}`,
      name: `Producto ${page}-${i}`,
      slug: `p${page}-${i}`,
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

function productLinks(harness: RouterTestingHarness): HTMLAnchorElement[] {
  return Array.from(harness.routeNativeElement?.querySelectorAll('.product-card__link') ?? []);
}

async function openModal(harness: RouterTestingHarness, index = 0): Promise<HTMLAnchorElement> {
  const link = productLinks(harness)[index];
  fireEvent.click(link);
  await harness.fixture.whenStable();
  return link;
}

function dialog(harness: RouterTestingHarness): HTMLElement {
  const element = harness.routeNativeElement?.querySelector('[role="dialog"]');
  if (!element) {
    throw new Error('dialog not found');
  }
  return element as HTMLElement;
}

describe('CatalogPage', () => {
  let listProducts: ReturnType<typeof vi.fn>;
  let listCategories: ReturnType<typeof vi.fn>;
  let getProduct: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    listProducts = vi.fn();
    listCategories = vi.fn().mockReturnValue(of([]));
    // Resuelto por defecto con un producto mínimo: estos tests comprueban el
    // diálogo (URL, foco, `inert`, scroll), no el contenido — eso ya lo
    // cubre `product-detail-modal.spec.ts`. Un `Subject` que nunca emite
    // dejaría el `resource()` en "loading" para siempre, y con eso
    // `fixture.whenStable()` (que espera las tareas pendientes de la app,
    // incluidas las de `resource()`/`httpResource()` en zoneless) no se
    // resolvería nunca.
    getProduct = vi.fn().mockReturnValue(
      of({ id: 'p0-0', name: 'Producto', slug: 'p0-0', price: 10, effectivePrice: 10, currency: 'USD' }),
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter(TEST_ROUTES),
        provideLocationMocks(),
        { provide: PublicCatalogControllerService, useValue: { listProducts, listCategories, getProduct } },
        { provide: MAX_SELECTION, useValue: 20 },
        { provide: SITE_URL, useValue: 'https://tienda.test' },
        { provide: WHATSAPP_SETTINGS, useValue: WHATSAPP_SETTINGS_VALUE },
      ],
    });
  });

  afterEach(() => {
    document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
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

  it('case 25: shows the empty state with a clear-filters button when nothing matches', async () => {
    listProducts.mockReturnValue(of(buildResponse(0, 0, false)));

    const harness = await createHarness('/?category=inexistente');
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.textContent).toContain('No hay productos que coincidan');
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(0);

    const location = TestBed.inject(Location);
    const clearButton = harness.routeNativeElement?.querySelector('.catalog-page__empty-clear') as HTMLButtonElement;
    fireEvent.click(clearButton);
    await harness.fixture.whenStable();

    expect(location.path()).not.toContain('?');
  });

  it('feeds the desktop filter panel with the categories and counts from listCategories', async () => {
    listProducts.mockReturnValue(of(buildResponse(0, 1, false)));
    listCategories.mockReturnValue(
      of([
        { slug: 'aceites', name: 'Aceites', productCount: 12 },
        { slug: 'cremas', name: 'Cremas', productCount: 5 },
      ]),
    );

    const harness = await createHarness();
    await harness.fixture.whenStable();

    expect(harness.routeNativeElement?.textContent).toContain('Aceites (12)');
    expect(harness.routeNativeElement?.textContent).toContain('Cremas (5)');
  });

  describe('SEO (W11)', () => {
    it('sets title, canonical, Open Graph and BreadcrumbList JSON-LD unconditionally', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 3, true)));

      const harness = await createHarness();
      await harness.fixture.whenStable();

      expect(document.title).toBe('Mi Tienda — Catálogo');
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://tienda.test/');
      expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
      expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Mi Tienda');

      const breadcrumb = JSON.parse(document.querySelector('script#ld-breadcrumb')?.textContent ?? '{}');
      expect(breadcrumb).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://tienda.test/' }],
      });
    });

    it('sets an ItemList JSON-LD block once the first batch resolves', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 2, true)));

      const harness = await createHarness();
      await harness.fixture.whenStable();

      const itemList = JSON.parse(document.querySelector('script#ld-itemlist')?.textContent ?? '{}');
      expect(itemList).toEqual({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, url: 'https://tienda.test/p/p0-0', name: 'Producto 0-0' },
          { '@type': 'ListItem', position: 2, url: 'https://tienda.test/p/p0-1', name: 'Producto 0-1' },
        ],
      });
    });

    it('the canonical never reflects an active filter', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 1, false)));

      const harness = await createHarness('/?category=aceites&sort=newest&q=lavanda');
      await harness.fixture.whenStable();

      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://tienda.test/');
    });
  });

  describe('W7 — modal de detalle sobre el grid', () => {
    it('case 32: opening a card shows the dialog and changes the URL to /p/:slug without a full navigation', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 2, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      await openModal(harness, 0);

      expect(TestBed.inject(Location).path()).toBe('/p/p0-0');
      expect(harness.routeNativeElement?.querySelector('[role="dialog"]')).toBeTruthy();
      // El grid sigue montado detrás, solo queda `inert` — no una navegación real.
      expect(harness.routeNativeElement?.querySelectorAll('app-product-card')).toHaveLength(2);
    });

    it('puts inert on the grid while the modal is open, and removes it on close', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 1, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      const main = harness.routeNativeElement?.querySelector('main.catalog-page') as HTMLElement;
      expect(main.hasAttribute('inert')).toBe(false);

      await openModal(harness);
      expect(main.hasAttribute('inert')).toBe(true);

      fireEvent.keyDown(dialog(harness), { key: 'Escape' });
      await harness.fixture.whenStable();
      expect(main.hasAttribute('inert')).toBe(false);
    });

    it('case 34: Escape closes the dialog and the URL goes back to /', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 1, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      await openModal(harness);
      fireEvent.keyDown(dialog(harness), { key: 'Escape' });
      await harness.fixture.whenStable();

      expect(harness.routeNativeElement?.querySelector('[role="dialog"]')).toBeNull();
      expect(TestBed.inject(Location).path()).toBe('/');
    });

    it('case 35: focus moves into the dialog and stays trapped there while it is open', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 1, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      await openModal(harness);

      expect(dialog(harness).contains(document.activeElement)).toBe(true);
    });

    it('case 36: closing returns focus to the exact card that opened the modal, not just any card', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 3, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      const openedLink = await openModal(harness, 1);
      fireEvent.keyDown(dialog(harness), { key: 'Escape' });
      await harness.fixture.whenStable();

      expect(document.activeElement).toBe(openedLink);
    });

    it('case 39: locks background scroll while the modal is open and restores it on close', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 1, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      await openModal(harness);
      expect(document.documentElement.style.overflow).toBe('hidden');

      fireEvent.keyDown(dialog(harness), { key: 'Escape' });
      await harness.fixture.whenStable();
      expect(document.documentElement.style.overflow).toBe('');
    });

    it('the real back button (popstate) closes the modal too, without a second location.back() call', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 1, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      await openModal(harness);
      const location = TestBed.inject(Location);
      // Simula el botón "atrás" real del navegador, no un cierre desde la UI.
      location.back();
      await harness.fixture.whenStable();

      expect(harness.routeNativeElement?.querySelector('[role="dialog"]')).toBeNull();
      expect(location.path()).toBe('/');
    });
  });

  describe('selección múltiple (W9)', () => {
    it('toggling a card checkbox calls SelectionService.toggle and reflects back as checked', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 2, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      const checkbox = harness.routeNativeElement?.querySelectorAll('[role="checkbox"]')[0] as HTMLButtonElement;
      expect(checkbox.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(checkbox);
      await harness.fixture.whenStable();

      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    });

    it('case 54: applies the bottom-padding class to the grid container while the selection bar is visible', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 2, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();

      const content = harness.routeNativeElement?.querySelector('.catalog-page__content') as HTMLElement;
      expect(content.classList.contains('catalog-page__content--bar-visible')).toBe(false);

      const checkbox = harness.routeNativeElement?.querySelectorAll('[role="checkbox"]')[0] as HTMLButtonElement;
      fireEvent.click(checkbox);
      await harness.fixture.whenStable();

      expect(content.classList.contains('catalog-page__content--bar-visible')).toBe(true);

      fireEvent.click(checkbox);
      await harness.fixture.whenStable();

      expect(content.classList.contains('catalog-page__content--bar-visible')).toBe(false);
    });
  });

  describe('WhatsApp individual (W10)', () => {
    it('clicking a card\'s WhatsApp button opens the preview with a single, quantity-1 line', async () => {
      listProducts.mockReturnValue(of(buildResponse(0, 2, false)));
      const harness = await createHarness();
      await harness.fixture.whenStable();
      const whatsappPreview = TestBed.inject(WhatsAppPreviewService);

      const button = harness.routeNativeElement?.querySelector('.product-card__whatsapp-button') as HTMLButtonElement;
      fireEvent.click(button);
      await harness.fixture.whenStable();

      expect(whatsappPreview.open()).toBe(true);
      expect(whatsappPreview.lines()).toEqual([expect.objectContaining({ slug: 'p0-0', quantity: 1 })]);
    });
  });
});
