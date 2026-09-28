import { fireEvent, render, screen } from '@testing-library/angular';
import { ImageDetailRef } from '../../../api/model/image-detail-ref';
import { ProductImageCarousel } from './product-image-carousel';

function buildImages(count: number): ImageDetailRef[] {
  return Array.from({ length: count }, (_, i) => ({
    altText: `Imagen ${i + 1}`,
    detail: { webp: `/media/p1/detail-${i}.webp`, jpeg: `/media/p1/detail-${i}.jpg`, width: 1400, height: 1400 },
  }));
}

/** Cada slide también lleva una etiqueta oculta con el mismo texto que el
 *  `aria-live` (p. ej. "Imagen 2 de 3"), así que hay que apuntar siempre a
 *  la región `aria-live` explícitamente para no chocar con esa otra copia. */
function liveText(container: HTMLElement): string | null {
  return container.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? null;
}

describe('ProductImageCarousel', () => {
  it('renders one dot per image and announces the current image', async () => {
    const { container } = await render(ProductImageCarousel, { inputs: { images: buildImages(3) } });

    expect(container.querySelectorAll('.product-image-carousel__dot')).toHaveLength(3);
    expect(liveText(container)).toBe('Imagen 1 de 3');
  });

  it('navigates and announces the new image when a dot is clicked', async () => {
    const { container, fixture } = await render(ProductImageCarousel, { inputs: { images: buildImages(3) } });

    const dots = container.querySelectorAll('.product-image-carousel__dot');
    fireEvent.click(dots[2]);
    fixture.detectChanges();

    expect(dots[2].getAttribute('aria-current')).toBe('true');
    expect(liveText(container)).toBe('Imagen 3 de 3');
  });

  it('navigates with the ArrowRight/ArrowLeft keys', async () => {
    const { container, fixture } = await render(ProductImageCarousel, { inputs: { images: buildImages(3) } });

    const root = container.querySelector('.product-image-carousel') as HTMLElement;
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    fixture.detectChanges();
    expect(liveText(container)).toBe('Imagen 2 de 3');

    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    fixture.detectChanges();
    expect(liveText(container)).toBe('Imagen 1 de 3');
  });

  it('marks the boundary arrows as aria-disabled, never with the disabled attribute', async () => {
    const { container } = await render(ProductImageCarousel, { inputs: { images: buildImages(2) } });

    const previous = screen.getByRole('button', { name: 'Imagen anterior' });
    const next = screen.getByRole('button', { name: 'Siguiente imagen' });

    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(previous.hasAttribute('disabled')).toBe(false);
    expect(next.getAttribute('aria-disabled')).toBeNull();

    const describedById = previous.getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedById}`)?.textContent).toContain('primera imagen');
  });

  it('does not render navigation controls with a single image', async () => {
    await render(ProductImageCarousel, { inputs: { images: buildImages(1) } });

    expect(screen.queryByRole('button', { name: 'Imagen anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: /ir a la imagen/i })).toBeNull();
  });
});
