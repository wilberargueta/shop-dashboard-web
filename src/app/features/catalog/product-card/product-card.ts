import { Component, computed, input, output } from '@angular/core';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';
import { ProductPrice } from '../../../shared/product-price/product-price';
import { BREAKPOINTS } from '../../../shared/breakpoints';

export interface ProductCardOpenEvent {
  slug: string;
  origin: HTMLAnchorElement;
}

@Component({
  selector: 'app-product-card',
  imports: [ProductPrice],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  readonly product = input.required<ProductCardDto>();
  readonly priority = input(false);
  readonly selected = input(false);
  /** Tope de selección alcanzado y esta tarjeta todavía no está seleccionada (W9). */
  readonly selectionDisabled = input(false);

  readonly open = output<ProductCardOpenEvent>();
  readonly selectionToggle = output<ProductCardDto>();
  readonly whatsappRequested = output<ProductCardDto>();

  protected readonly cardImage = computed(() => this.product().primaryImage?.card ?? null);
  protected readonly card2xImage = computed(() => this.product().primaryImage?.card2x ?? null);
  protected readonly detailHref = computed(() => `/p/${this.product().slug ?? ''}`);

  /**
   * Un clic modificado (botón central, Ctrl/Cmd/Shift/Alt) es la señal del
   * usuario de que quiere abrir en pestaña/ventana nueva: se deja pasar la
   * navegación nativa del `<a>` en vez de interceptarla para abrir el modal
   * (W7, PROJECT_SPEC.md §2).
   */
  protected onLinkClick(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    const slug = this.product().slug;
    if (!slug) {
      return;
    }
    event.preventDefault();
    this.open.emit({ slug, origin: event.currentTarget as HTMLAnchorElement });
  }

  /**
   * Ver el ejemplo de <picture> en PROJECT_SPEC.md §5; debe coincidir con las
   * columnas reales del grid (product-grid.scss), que usa los mismos
   * breakpoints de `BREAKPOINTS` (src/app/shared/breakpoints.ts).
   */
  protected readonly imageSizes =
    `(min-width: ${BREAKPOINTS.lg}px) 33vw, ` +
    `(min-width: ${BREAKPOINTS.md}px) 50vw, ` +
    `100vw`;

  /** W3.1: `card2x` (1200w) se suma al mismo `srcset` que `card` (600w) cuando el backend lo publica; `sizes` no cambia. */
  protected readonly cardSrcsetWebp = computed(() => {
    const candidates = [this.srcsetCandidate(this.cardImage(), 'webp'), this.srcsetCandidate(this.card2xImage(), 'webp')];
    return this.joinSrcset(candidates);
  });

  protected readonly cardSrcsetFallback = computed(() => {
    const image = this.cardImage();
    const candidates = [
      this.srcsetCandidate(image, image?.jpeg ? 'jpeg' : 'webp'),
      this.srcsetCandidate(this.card2xImage(), this.card2xImage()?.jpeg ? 'jpeg' : 'webp'),
    ];
    return this.joinSrcset(candidates);
  });

  private srcsetCandidate(image: { webp?: string; jpeg?: string; width?: number } | null, format: 'webp' | 'jpeg'): string | null {
    const url = format === 'jpeg' ? image?.jpeg : image?.webp;
    return url ? `${url} ${image?.width ?? 600}w` : null;
  }

  private joinSrcset(candidates: readonly (string | null)[]): string | null {
    const present = candidates.filter((candidate): candidate is string => candidate !== null);
    return present.length > 0 ? present.join(', ') : null;
  }

  protected readonly outOfStockReasonId = computed(() => `product-card-oos-${this.product().id}`);
  protected readonly selectionCapReasonId = computed(() => `product-card-cap-${this.product().id}`);

  /** Mismo criterio que el botón "Agotado": `aria-disabled`, nunca `disabled`, y el manejador retorna temprano. */
  protected onSelectionToggle(): void {
    if (this.selectionDisabled() && !this.selected()) {
      return;
    }
    this.selectionToggle.emit(this.product());
  }

  /** Igual criterio de accesibilidad: `aria-disabled` cuando está agotado, el manejador retorna temprano. */
  protected onWhatsappClick(): void {
    if (this.product().inStock === false) {
      return;
    }
    this.whatsappRequested.emit(this.product());
  }
}
