import { Location, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  ListProductsRequestParams,
  PublicCatalogControllerService,
} from '../../../api/api/public-catalog-controller.service';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';
import { ProductDetailModal } from '../../product/product-detail-modal/product-detail-modal';
import { CatalogFilterMobilePanel } from '../catalog-filter-mobile-panel/catalog-filter-mobile-panel';
import { CatalogFilterPanel } from '../catalog-filter-panel/catalog-filter-panel';
import { CatalogLoadMore } from '../catalog-load-more/catalog-load-more';
import { DEFAULT_CATALOG_SORT, CatalogFilters } from '../catalog-query.model';
import { CatalogQueryService } from '../catalog-query.service';
import { ProductCardOpenEvent } from '../product-card/product-card';
import { ProductGrid } from '../product-grid/product-grid';

const DETAIL_PATH_PREFIX = '/p/';

/**
 * Contenedor de la ruta "/". Acumula lotes de `listProducts()` en scroll
 * infinito (W4): la profundidad de scroll es estado solo de cliente, nunca
 * de la URL — el servidor siempre renderiza la página 0
 * (PROJECT_SPEC.md §3, "El servidor renderiza solo el primer lote").
 *
 * También abre el modal de detalle sobre el grid (W7): `Location.go()` /
 * `Location.back()` cambian la URL a `/p/:slug` sin pasar por el `Router`
 * (que solo reacciona a `popstate`, nunca a un `pushState` programático),
 * así que este componente nunca se destruye al abrir o cerrar el modal.
 */
@Component({
  selector: 'app-catalog-page',
  imports: [ProductGrid, CatalogLoadMore, CatalogFilterPanel, CatalogFilterMobilePanel, ProductDetailModal],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.css',
})
export class CatalogPage {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly catalogQuery = inject(CatalogQueryService);
  private readonly publicCatalogController = inject(PublicCatalogControllerService);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly openSlug = signal<string | null>(null);
  protected readonly modalOrigin = signal<HTMLElement | null>(null);

  /**
   * Página que se pide a continuación. Nunca vive en la URL (W4):
   * `linkedSignal` la reinicia a 0 de forma síncrona en el mismo recálculo
   * reactivo en el que cambian los filtros, para que `requestParams` nunca
   * vea una combinación intermedia (filtros nuevos con la página vieja) —
   * un `effect()` aparte para el reseteo llega un tick tarde y produce esa
   * petición fantasma.
   */
  private readonly requestedPage = linkedSignal({
    source: () => this.catalogQuery.filters(),
    computation: () => 0,
  });

  /** Misma razón que `requestedPage`: reseteo síncrono con los filtros. */
  private readonly accumulatedProducts = linkedSignal({
    source: () => this.catalogQuery.filters(),
    computation: (): readonly ProductCardDto[] => [],
  });

  /**
   * Guarda explícita y síncrona de "una sola petición en vuelo" (caso 15):
   * se fija en el mismo tick en que se decide pedir el siguiente lote, sin
   * depender de cuándo `rxResource` propaga `isLoading()`.
   */
  private readonly nextPageInFlight = signal(false);
  private readonly nextPageError = signal(false);

  private readonly requestParams = computed<ListProductsRequestParams>(() => {
    const filters = this.catalogQuery.filters();
    const page = this.catalogQuery.page();

    const params: ListProductsRequestParams = { page: this.requestedPage() };
    // `featured` es solo el comportamiento por defecto del backend cuando no
    // se manda `sort` — ARQUITECTURA.md §5.1 no lo lista como valor de la
    // lista blanca. Mandarlo explícito da 400 ("valor no permitido").
    if (filters.sort !== DEFAULT_CATALOG_SORT) {
      params.sort = filters.sort;
    }
    if (page.size !== null) {
      params.size = page.size;
    }
    if (filters.categories.length > 0) {
      params.category = [...filters.categories];
    }
    if (filters.minPrice !== null) {
      params.minPrice = filters.minPrice;
    }
    if (filters.maxPrice !== null) {
      params.maxPrice = filters.maxPrice;
    }
    if (filters.q !== null) {
      params.q = filters.q;
    }
    if (filters.onSale !== null) {
      params.onSale = filters.onSale;
    }
    if (filters.inStock !== null) {
      params.inStock = filters.inStock;
    }

    return params;
  });

  private readonly pageResource = rxResource({
    params: this.requestParams,
    stream: ({ params }) => this.publicCatalogController.listProducts(params),
  });

  /** Sin `params`: no depende de nada reactivo, se pide una sola vez (también en SSR, igual que `pageResource`). */
  private readonly categoriesResource = rxResource({
    stream: () => this.publicCatalogController.listCategories(),
  });

  protected readonly categories = computed(() => this.categoriesResource.value() ?? []);
  protected readonly filters = this.catalogQuery.filters;
  protected readonly products = this.accumulatedProducts.asReadonly();
  /** Caso 25: solo tras resolver, para no confundir "cargando" con "sin resultados". */
  protected readonly isEmpty = computed(
    () => this.pageResource.status() === 'resolved' && this.accumulatedProducts().length === 0,
  );
  /**
   * `pageResource.value()` lanza si el estado no es 'resolved' (incluido
   * 'error' — así lo implementa `resource()` internamente). Por eso todo
   * acceso a `.value()` en este componente pasa primero por `.status()`.
   */
  protected readonly hasNext = computed(() =>
    this.pageResource.status() === 'resolved' ? (this.pageResource.value()?.hasNext ?? false) : false,
  );
  protected readonly isLoadingFirst = computed(
    () => this.pageResource.isLoading() && this.accumulatedProducts().length === 0,
  );
  protected readonly isLoadingMore = this.nextPageInFlight.asReadonly();
  protected readonly hasLoadError = this.nextPageError.asReadonly();

  constructor() {
    // El reseteo de la lista y la página ya lo hacen los `linkedSignal` de
    // arriba; aquí solo quedan los efectos secundarios que no participan en
    // qué se pide a la API: limpiar el estado de "cargando más"/error de un
    // lote anterior y subir el scroll (PROJECT_SPEC.md §3.8, caso 18).
    effect(() => {
      this.catalogQuery.filters();
      untracked(() => {
        this.nextPageInFlight.set(false);
        this.nextPageError.set(false);
        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo({ top: 0 });
        }
      });
    });

    // Una respuesta de página 0 siempre reemplaza la lista (cubre tanto la
    // carga inicial como el reseteo de arriba); cualquier otra página se
    // acumula al final. Solo se lee `.value()` con status 'resolved': en
    // cualquier otro estado (incluido 'error') esa lectura lanza.
    effect(() => {
      if (this.pageResource.status() !== 'resolved') {
        return;
      }
      const response = this.pageResource.value();
      if (!response) {
        return;
      }
      untracked(() => {
        const content = response.content ?? [];
        this.accumulatedProducts.update((list) => (response.page === 0 ? content : [...list, ...content]));
        this.nextPageInFlight.set(false);
        this.nextPageError.set(false);
      });
    });

    effect(() => {
      const error = this.pageResource.error();
      if (error === undefined) {
        return;
      }
      untracked(() => {
        this.nextPageInFlight.set(false);
        this.nextPageError.set(true);
      });
    });

    // Caso 33 (W7): el botón "atrás" real dispara `popstate`, que `Location`
    // reenvía aquí de forma sincrónica en los tests (`SpyLocation`). Como
    // `location.go()` nunca pasa por el `Router`, este es el único sitio que
    // se entera de que la URL volvió a `/` y debe cerrar el modal — sin
    // volver a llamar a `location.back()`, que ya se hizo (o fue el propio
    // navegador). Simétricamente, el botón "adelante" reabre el modal.
    const locationSubscription = this.location.subscribe(() => {
      const isDetailPath = this.location.path().startsWith(DETAIL_PATH_PREFIX);
      if (isDetailPath && this.openSlug() === null) {
        this.modalOrigin.set(null);
        this.openSlug.set(this.location.path().slice(DETAIL_PATH_PREFIX.length));
      } else if (!isDetailPath && this.openSlug() !== null) {
        this.openSlug.set(null);
        this.modalOrigin.set(null);
      }
    });
    this.destroyRef.onDestroy(() => locationSubscription.unsubscribe());

    // Caso 39: sin scroll del fondo mientras el modal está abierto. El grid
    // nunca sale del DOM (solo se le pone `inert`), así que al desbloquear
    // el scroll la ventana sigue exactamente donde estaba (caso 33) sin
    // necesidad de guardar/restaurar nada a mano.
    effect(() => {
      const isOpen = this.openSlug() !== null;
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      untracked(() => {
        document.documentElement.style.overflow = isOpen ? 'hidden' : '';
      });
    });
    this.destroyRef.onDestroy(() => {
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.style.overflow = '';
      }
    });
  }

  /** Único punto de entrada de la tarjeta clicada/activada por teclado (W7). */
  protected onProductOpen({ slug, origin }: ProductCardOpenEvent): void {
    this.modalOrigin.set(origin);
    this.openSlug.set(slug);
    this.location.go(`${DETAIL_PATH_PREFIX}${slug}`);
  }

  /** Cierre explícito (X, fondo, Escape): saca del historial la entrada que empujó `onProductOpen`. */
  protected onModalClose(): void {
    if (this.openSlug() === null) {
      return;
    }
    this.openSlug.set(null);
    this.location.back();
  }

  /**
   * Único punto de entrada del centinela y del botón "Cargar más"/"Reintentar".
   * Casos 15 (una sola petición en vuelo), 16 (fin de lista) y 17 (reintentar).
   */
  protected onLoadMore(): void {
    if (this.nextPageInFlight()) {
      return;
    }
    if (this.nextPageError()) {
      this.nextPageError.set(false);
      this.nextPageInFlight.set(true);
      this.pageResource.reload();
      return;
    }
    if (!this.hasNext()) {
      return;
    }
    this.nextPageInFlight.set(true);
    this.requestedPage.update((page) => page + 1);
  }

  protected onFiltersChange(patch: Partial<CatalogFilters>): void {
    this.catalogQuery.updateFilters(patch);
  }

  protected onClearFilters(): void {
    this.catalogQuery.clearFilters();
  }
}
