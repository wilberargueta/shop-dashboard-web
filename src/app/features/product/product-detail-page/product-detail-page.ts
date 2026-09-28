import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  RESPONSE_INIT,
  TransferState,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { ProductDetail } from '../../../api/model/product-detail';
import { WHATSAPP_SETTINGS } from '../../../core/config/whatsapp-settings.token';
import { SITE_URL } from '../../../core/config/site-url.token';
import { ApiError } from '../../../core/http/problem-detail.model';
import { cacheFirstValue } from '../../../core/http/transfer-state-cache';
import { SeoService } from '../../../core/seo/seo.service';
import { buildProductJsonLd, resolveAbsoluteDetailImage } from '../../../core/seo/seo.schema';
import { ProductDetailSkeleton } from '../../../shared/product-detail-skeleton/product-detail-skeleton';
import { SelectionService } from '../../selection/selection.service';
import { toSelectionLine } from '../../selection/selection.model';
import { WhatsAppPreviewService } from '../../selection/whatsapp-preview/whatsapp-preview.service';
import {
  AddToSelectionEvent,
  ProductDetailContent,
  WhatsAppRequestedEvent,
} from '../product-detail-content/product-detail-content';

/**
 * `resource()`/`rxResource()` envuelve cualquier error que no "parezca" un
 * `Error` (sin `.name`/`.message`, que es justo la forma de `ApiError`) en
 * un `ResourceWrappedError`, guardando el valor original en `.cause`
 * (`encapsulateResourceError` en `@angular/core`, verificado leyendo su
 * fuente). Hay que desenvolverlo para leer el `status` real.
 */
function extractApiError(error: unknown): ApiError | null {
  const candidate = error instanceof Error ? error.cause : error;
  if (typeof candidate === 'object' && candidate !== null && typeof (candidate as ApiError).status === 'number') {
    return candidate as ApiError;
  }
  return null;
}

function isNotFoundError(error: unknown): boolean {
  return extractApiError(error)?.status === 404;
}

/**
 * Contenedor de la ruta `/p/:slug`. Un slug inexistente o de un producto no
 * publicado llega como `ApiError{status: 404}` (el backend no distingue las
 * dos causas — ARQUITECTURA.md §4.2 — y este componente tampoco lo intenta):
 * se marca `RESPONSE_INIT.status = 404` para que el servidor devuelva un 404
 * real (casos 42 y 43), en vez de cambiar de ruta.
 */
@Component({
  selector: 'app-product-detail-page',
  imports: [ProductDetailContent, ProductDetailSkeleton, RouterLink],
  templateUrl: './product-detail-page.html',
  styleUrl: './product-detail-page.css',
})
export class ProductDetailPage {
  readonly slug = input.required<string>();

  private readonly publicCatalogController = inject(PublicCatalogControllerService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly seo = inject(SeoService);
  private readonly storeName = inject(WHATSAPP_SETTINGS).storeName;
  private readonly siteUrl = inject(SITE_URL);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly selection = inject(SelectionService);
  private readonly whatsappPreview = inject(WhatsAppPreviewService);
  private readonly transferState = inject(TransferState);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly productResource = rxResource({
    params: this.slug,
    stream: ({ params }) =>
      cacheFirstValue(
        this.transferState,
        isPlatformBrowser(this.platformId),
        `product-detail:${params}`,
        this.publicCatalogController.getProduct({ slug: params }),
      ),
  });

  protected readonly isLoading = computed(() => this.productResource.isLoading());
  protected readonly notFound = computed(() => isNotFoundError(this.productResource.error()));
  protected readonly hasError = computed(() => this.productResource.status() === 'error' && !this.notFound());
  /** `.value()` lanza si el estado no es 'resolved' (ver CatalogPage). */
  protected readonly product = computed(() =>
    this.productResource.status() === 'resolved' ? this.productResource.value() : undefined,
  );
  protected readonly isSelected = computed(() => {
    const productId = this.product()?.id;
    return productId !== undefined && this.selection.isSelected(productId);
  });
  protected readonly selectionCapReached = this.selection.capReached;

  constructor() {
    effect(() => {
      if (!this.notFound()) {
        return;
      }
      untracked(() => {
        // Solo existe durante el render en servidor; en el navegador es `null`.
        if (this.responseInit) {
          this.responseInit.status = 404;
        }
      });
    });

    effect(() => {
      const product = this.product();
      if (!product) {
        return;
      }
      untracked(() => this.updateMetaTags(product));
    });

    this.destroyRef.onDestroy(() => this.seo.removeJsonLd('ld-product'));
  }

  protected onAddToSelection(event: AddToSelectionEvent): void {
    this.selection.add(event.product, event.quantity);
  }

  protected onRemoveFromSelection(productId: string): void {
    this.selection.remove(productId);
  }

  protected onWhatsappRequested({ product, quantity }: WhatsAppRequestedEvent): void {
    const line = toSelectionLine(product, quantity);
    if (!line) {
      return;
    }
    this.whatsappPreview.openWith([line], document.activeElement as HTMLElement | null);
  }

  private updateMetaTags(product: ProductDetail): void {
    const url = `${this.siteUrl}/p/${this.slug()}`;
    // Sin `settings.seo.default_og_image_id` disponible todavía (bloqueado
    // por B11 del backend, misma desviación documentada en W1): un producto
    // sin imágenes simplemente no publica `og:image`/`twitter:image`, en vez
    // de inventar un respaldo.
    const image = resolveAbsoluteDetailImage(this.siteUrl, product.images);

    this.seo.updatePageTags({
      title: product.name ?? '',
      description: product.shortDescription ?? '',
      url,
      type: 'product',
      image,
    });

    this.seo.setJsonLd(
      'ld-product',
      buildProductJsonLd({ siteUrl: this.siteUrl, storeName: this.storeName, url, product }),
    );
  }
}
