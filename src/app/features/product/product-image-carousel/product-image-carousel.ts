import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ImageDetailRef } from '../../../api/model/image-detail-ref';

let nextInstanceId = 0;

/**
 * Carrusel de imágenes `detail` del producto. Presentación pura. El
 * deslizamiento táctil es el gesto nativo del navegador sobre
 * `scroll-snap` (ARQUITECTURA.md §8.5) — nunca una librería que capture el
 * touch. Las flechas, los puntos y las flechas del teclado llaman a
 * `goTo()`, que desplaza la pista con `scrollIntoView`; un listener de
 * `scroll` (creado en `afterNextRender`, nunca en servidor) reconcilia el
 * índice cuando el usuario desliza a mano en vez de usar los controles.
 */
@Component({
  selector: 'app-product-image-carousel',
  templateUrl: './product-image-carousel.html',
  styleUrl: './product-image-carousel.scss',
})
export class ProductImageCarousel {
  readonly images = input.required<readonly ImageDetailRef[]>();

  protected readonly instanceId = `product-image-carousel-${nextInstanceId++}`;
  protected readonly currentIndex = signal(0);
  protected readonly total = computed(() => this.images().length);
  protected readonly isFirst = computed(() => this.currentIndex() <= 0);
  protected readonly isLast = computed(() => this.currentIndex() >= this.total() - 1);

  private readonly track = viewChild<ElementRef<HTMLUListElement>>('track');
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const trackEl = this.track()?.nativeElement;
      if (!trackEl) {
        return;
      }

      let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
      const onScroll = (): void => {
        if (scrollTimeout !== undefined) {
          clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => this.syncIndexFromScroll(trackEl), 100);
      };

      trackEl.addEventListener('scroll', onScroll, { passive: true });
      this.destroyRef.onDestroy(() => {
        trackEl.removeEventListener('scroll', onScroll);
        if (scrollTimeout !== undefined) {
          clearTimeout(scrollTimeout);
        }
      });
    });
  }

  protected onPrevious(): void {
    if (this.isFirst()) {
      return;
    }
    this.goTo(this.currentIndex() - 1);
  }

  protected onNext(): void {
    if (this.isLast()) {
      return;
    }
    this.goTo(this.currentIndex() + 1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.onNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.onPrevious();
    }
  }

  protected goTo(index: number): void {
    const clamped = Math.min(Math.max(index, 0), Math.max(this.total() - 1, 0));
    this.currentIndex.set(clamped);

    const trackEl = this.track()?.nativeElement;
    const slide = trackEl?.children.item(clamped) as HTMLElement | null;
    slide?.scrollIntoView?.({
      behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }

  private syncIndexFromScroll(trackEl: HTMLElement): void {
    const slideWidth = trackEl.clientWidth;
    if (slideWidth === 0) {
      return;
    }
    const index = Math.round(trackEl.scrollLeft / slideWidth);
    const clamped = Math.min(Math.max(index, 0), Math.max(this.total() - 1, 0));
    if (clamped !== this.currentIndex()) {
      this.currentIndex.set(clamped);
    }
  }

  private prefersReducedMotion(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
