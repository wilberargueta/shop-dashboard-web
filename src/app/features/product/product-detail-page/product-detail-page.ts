import { Component, RESPONSE_INIT, computed, effect, inject, input, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { ProductDetail } from '../../../api/model/product-detail';
import { SITE_URL } from '../../../core/config/site-url.token';
import { ApiError } from '../../../core/http/problem-detail.model';
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
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly siteUrl = inject(SITE_URL);
  protected readonly selection = inject(SelectionService);
  private readonly whatsappPreview = inject(WhatsAppPreviewService);

  private readonly productResource = rxResource({
    params: this.slug,
    stream: ({ params }) => this.publicCatalogController.getProduct({ slug: params }),
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

    this.title.setTitle(product.name ?? '');
    this.meta.updateTag({ name: 'description', content: product.shortDescription ?? '' });
    this.meta.updateTag({ property: 'og:type', content: 'product' });
    this.meta.updateTag({ property: 'og:title', content: product.name ?? '' });
    this.meta.updateTag({ property: 'og:description', content: product.shortDescription ?? '' });
    this.meta.updateTag({ property: 'og:url', content: url });

    // Sin `settings.seo.default_og_image_id` disponible todavía (bloqueado
    // por B11 del backend, misma desviación documentada en W1): un producto
    // sin imágenes simplemente no publica `og:image`, en vez de inventar un
    // respaldo.
    const image = product.images?.[0]?.detail;
    const imageUrl = image?.webp ?? image?.jpeg;
    if (imageUrl) {
      this.meta.updateTag({ property: 'og:image', content: `${this.siteUrl}${imageUrl}` });
    }
  }
}
