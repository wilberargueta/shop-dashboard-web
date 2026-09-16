import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { PublicCatalogControllerService } from '../../../api/api/public-catalog-controller.service';
import { ProductCard as ProductCardDto } from '../../../api/model/product-card';
import { MAX_SELECTION } from '../../../core/config/max-selection.token';
import { SelectionService } from '../selection.service';
import { WhatsAppPreviewService } from '../whatsapp-preview/whatsapp-preview.service';
import { SelectionRoot } from './selection-root';

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

describe('SelectionRoot', () => {
  beforeEach(() => sessionStorage.clear());

  function setup() {
    const getProduct = vi.fn();
    return render(SelectionRoot, {
      providers: [
        { provide: PublicCatalogControllerService, useValue: { getProduct } },
        { provide: MAX_SELECTION, useValue: 20 },
      ],
    });
  }

  it('renders no bar/panel and an empty live region when nothing is selected', async () => {
    await setup();

    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent?.trim()).toBe('');
  });

  it('announces the selection into the same persistent live-region node, and shows the bar', async () => {
    const { fixture } = await setup();
    const selection = TestBed.inject(SelectionService);
    const liveBefore = document.querySelector('[aria-live="polite"]');

    selection.add(buildProduct());
    fixture.detectChanges();

    const liveAfter = document.querySelector('[aria-live="polite"]');
    expect(liveAfter).toBe(liveBefore); // mismo nodo: nunca se insertó de nuevo
    expect(liveAfter?.textContent).toContain('1 producto seleccionado');
    expect(screen.getByRole('region', { name: 'Selección de productos' })).toBeTruthy();
  });

  it('"Ver" opens the selection panel', async () => {
    const { fixture } = await setup();
    const selection = TestBed.inject(SelectionService);
    selection.add(buildProduct());
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fixture.detectChanges();
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fixture.detectChanges();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('W10: "Enviar por WhatsApp" opens the WhatsApp preview with the full selection, not the panel', async () => {
    const { fixture } = await setup();
    const selection = TestBed.inject(SelectionService);
    const whatsappPreview = TestBed.inject(WhatsAppPreviewService);
    selection.add(buildProduct());
    fixture.detectChanges();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));
    fixture.detectChanges();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(whatsappPreview.open()).toBe(true);
    expect(whatsappPreview.lines()).toEqual(selection.lines());
  });

  it('W10: the selection panel\'s own "Enviar por WhatsApp" button also opens the preview', async () => {
    const { container, fixture } = await setup();
    const selection = TestBed.inject(SelectionService);
    const whatsappPreview = TestBed.inject(WhatsAppPreviewService);
    selection.add(buildProduct());
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fixture.detectChanges();

    const panelSendButton = container.querySelector('.selection-panel__send');
    if (!panelSendButton) throw new Error('panel send button not found');
    fireEvent.click(panelSendButton);
    fixture.detectChanges();

    expect(whatsappPreview.open()).toBe(true);
  });

  it('closes the panel automatically once the selection empties out', async () => {
    const { fixture } = await setup();
    const selection = TestBed.inject(SelectionService);
    selection.add(buildProduct());
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fixture.detectChanges();
    expect(screen.getByRole('dialog')).toBeTruthy();

    selection.remove('p1');
    fixture.detectChanges();

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
