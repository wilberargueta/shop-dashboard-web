import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { ProductDetail } from '../../../api/model/product-detail';
import { MAX_SELECTION } from '../../../core/config/max-selection.token';
import { ApiError } from '../../../core/http/problem-detail.model';
import { WhatsAppPreviewService } from '../../selection/whatsapp-preview/whatsapp-preview.service';
import { ProductDetailModal } from './product-detail-modal';

function buildProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 'p1',
    sku: 'ACE-001',
    name: 'Aceite esencial de lavanda 30ml',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 25,
    onSale: false,
    currency: 'USD',
    inStock: true,
    category: { slug: 'aceites', name: 'Aceites' },
    description: '<p>Relajante.</p>',
    images: [],
    ...overrides,
  };
}

describe('ProductDetailModal', () => {
  let getProduct: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    getProduct = vi.fn();
  });

  function renderModal(inputs: Partial<{ slug: string; returnFocusTo: HTMLElement | null }> = {}) {
    return render(ProductDetailModal, {
      inputs: { slug: 'aceite-esencial-de-lavanda-30ml', returnFocusTo: null, ...inputs },
      providers: [
        { provide: PublicCatalogControllerService, useValue: { getProduct } },
        { provide: MAX_SELECTION, useValue: 20 },
      ],
    });
  }

  it('shows a skeleton while the product is loading', async () => {
    getProduct.mockReturnValue(new Subject());

    const { container } = await renderModal();

    expect(container.querySelector('.product-detail-skeleton')).toBeTruthy();
  });

  it('renders the product once resolved, with the dialog labelled by its heading', async () => {
    getProduct.mockReturnValue(of(buildProduct()));

    await renderModal();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy as string);
    expect(heading?.tagName).toBe('H1');
    expect(heading?.textContent).toContain('Aceite esencial de lavanda 30ml');
  });

  it('shows a generic error message when the product fails to load', async () => {
    const apiError: ApiError = { status: 500, problem: null, retryAfterSeconds: null };
    getProduct.mockReturnValue(throwError(() => apiError));

    await renderModal();

    expect(screen.getByText('No se pudo cargar el producto. Inténtalo de nuevo más tarde.')).toBeTruthy();
  });

  it('emits closed on Escape and on the close button', async () => {
    getProduct.mockReturnValue(of(buildProduct()));
    const onClosed = vi.fn();

    await render(ProductDetailModal, {
      inputs: { slug: 'aceite-esencial-de-lavanda-30ml', returnFocusTo: null },
      providers: [
        { provide: PublicCatalogControllerService, useValue: { getProduct } },
        { provide: MAX_SELECTION, useValue: 20 },
      ],
      on: { closed: onClosed },
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClosed).toHaveBeenCalledTimes(2);
  });

  it('emits closed on backdrop click', async () => {
    getProduct.mockReturnValue(of(buildProduct()));
    const onClosed = vi.fn();

    const { container } = await render(ProductDetailModal, {
      inputs: { slug: 'aceite-esencial-de-lavanda-30ml', returnFocusTo: null },
      providers: [
        { provide: PublicCatalogControllerService, useValue: { getProduct } },
        { provide: MAX_SELECTION, useValue: 20 },
      ],
      on: { closed: onClosed },
    });

    const backdrop = container.querySelector('.product-detail-modal__backdrop');
    if (!backdrop) {
      throw new Error('backdrop not found');
    }
    fireEvent.click(backdrop);

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the dialog on mount', async () => {
    getProduct.mockReturnValue(of(buildProduct()));

    await renderModal();

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the given origin element when closed', async () => {
    getProduct.mockReturnValue(of(buildProduct()));
    const origin = document.createElement('button');
    document.body.appendChild(origin);

    const { fixture } = await renderModal({ returnFocusTo: origin });
    await fixture.whenStable();
    fixture.destroy();

    expect(document.activeElement).toBe(origin);
    origin.remove();
  });

  it('W9: adding to the selection here flips the button to "Quitar de la selección"', async () => {
    getProduct.mockReturnValue(of(buildProduct()));

    const { fixture } = await renderModal();

    const addButton = screen.getByRole('button', { name: 'Añadir a la selección' });
    fireEvent.click(addButton);
    fixture.detectChanges();

    expect(screen.getByRole('button', { name: 'Quitar de la selección' })).toBeTruthy();
  });

  it('W10: clicking the WhatsApp button opens the preview with a single line for this product', async () => {
    getProduct.mockReturnValue(of(buildProduct()));

    await renderModal();
    const whatsappPreview = TestBed.inject(WhatsAppPreviewService);

    fireEvent.click(screen.getByRole('button', { name: 'Consultar por WhatsApp' }));

    expect(whatsappPreview.open()).toBe(true);
    expect(whatsappPreview.lines()).toEqual([expect.objectContaining({ slug: 'aceite-esencial-de-lavanda-30ml', quantity: 1 })]);
  });
});
