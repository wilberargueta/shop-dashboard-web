import { render, screen, fireEvent } from '@testing-library/angular';
import { ProductDetail } from '../../../api/model/product-detail';
import { ProductDetailContent } from './product-detail-content';

function buildProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 'p1',
    sku: 'ACE-001',
    name: 'Aceite esencial de lavanda 30ml',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 25,
    onSale: false,
    discountPercentage: undefined,
    currency: 'USD',
    inStock: true,
    category: { slug: 'aceites', name: 'Aceites' },
    description: '<p>Relajante, 100% puro.</p>',
    usageInstructions: undefined,
    images: [
      {
        altText: 'Frasco de aceite de lavanda',
        detail: { webp: '/media/p1/detail.webp', jpeg: '/media/p1/detail.jpg', width: 1400, height: 1400 },
      },
    ],
    ...overrides,
  };
}

describe('ProductDetailContent', () => {
  it('shows name, SKU, price and availability', async () => {
    await render(ProductDetailContent, { inputs: { product: buildProduct() } });

    expect(screen.getByRole('heading', { name: 'Aceite esencial de lavanda 30ml' })).toBeTruthy();
    expect(screen.getByText('ACE-001', { exact: false })).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
  });

  it('shows "Agotado" and disables the quantity stepper when out of stock', async () => {
    await render(ProductDetailContent, { inputs: { product: buildProduct({ inStock: false }) } });

    expect(screen.getByText('Agotado')).toBeTruthy();
    expect(screen.getByRole('spinbutton').getAttribute('aria-disabled')).toBe('true');
  });

  it('does not render the usage instructions section when there are none (case 37)', async () => {
    await render(ProductDetailContent, { inputs: { product: buildProduct({ usageInstructions: undefined }) } });

    expect(screen.queryByText('Instrucciones de uso')).toBeNull();
  });

  it('renders the usage instructions section when present', async () => {
    await render(
      ProductDetailContent,
      { inputs: { product: buildProduct({ usageInstructions: '<p>Aplicar en las sienes.</p>' }) } },
    );

    expect(screen.getByText('Instrucciones de uso')).toBeTruthy();
    expect(screen.getByText('Aplicar en las sienes.')).toBeTruthy();
  });

  it('sanitizes the description binding, never executing embedded scripts', async () => {
    const { container } = await render(
      ProductDetailContent,
      { inputs: { product: buildProduct({ description: '<p>Hola</p><script>window.__xss = true;</script>' }) } },
    );

    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it('falls back to the local placeholder when the product has no images', async () => {
    const { container } = await render(ProductDetailContent, { inputs: { product: buildProduct({ images: [] }) } });

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/product-placeholder.svg');
  });

  it('W9: emits addToSelection with the product and the chosen quantity', async () => {
    const onAdd = vi.fn();
    await render(ProductDetailContent, {
      inputs: { product: buildProduct() },
      on: { addToSelection: onAdd },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la selección' }));

    expect(onAdd).toHaveBeenCalledWith({ product: buildProduct(), quantity: 2 });
  });

  it('W9: shows "Quitar de la selección" and emits removeFromSelection with the productId when already selected', async () => {
    const onRemove = vi.fn();
    await render(ProductDetailContent, {
      inputs: { product: buildProduct(), selected: true },
      on: { removeFromSelection: onRemove },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar de la selección' }));

    expect(onRemove).toHaveBeenCalledWith('p1');
  });

  it('W9: the add button is aria-disabled with an accessible reason when out of stock', async () => {
    const onAdd = vi.fn();
    const { container } = await render(ProductDetailContent, {
      inputs: { product: buildProduct({ inStock: false }) },
      on: { addToSelection: onAdd },
    });

    const button = screen.getByRole('button', { name: 'Añadir a la selección' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    const describedById = button.getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedById}`)?.textContent).toContain('Agotado');

    fireEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('W9: the add button is aria-disabled with a different reason when the selection cap is reached', async () => {
    const { container } = await render(ProductDetailContent, {
      inputs: { product: buildProduct(), selectionDisabled: true },
    });

    const button = screen.getByRole('button', { name: 'Añadir a la selección' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    const describedById = button.getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedById}`)?.textContent).toContain('Límite de selección alcanzado');
  });

  it('W9: an already-selected product stays operable even when the cap is reached', async () => {
    const onRemove = vi.fn();
    await render(ProductDetailContent, {
      inputs: { product: buildProduct(), selected: true, selectionDisabled: true },
      on: { removeFromSelection: onRemove },
    });

    const button = screen.getByRole('button', { name: 'Quitar de la selección' });
    expect(button.getAttribute('aria-disabled')).toBeNull();

    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledWith('p1');
  });

  it('W10: emits whatsappRequested with the product and the chosen quantity', async () => {
    const onWhatsappRequested = vi.fn();
    await render(ProductDetailContent, {
      inputs: { product: buildProduct() },
      on: { whatsappRequested: onWhatsappRequested },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar por WhatsApp' }));

    expect(onWhatsappRequested).toHaveBeenCalledWith({ product: buildProduct(), quantity: 2 });
  });

  it('W10: the WhatsApp button is aria-disabled with an accessible reason when out of stock, and does not emit', async () => {
    const onWhatsappRequested = vi.fn();
    const { container } = await render(ProductDetailContent, {
      inputs: { product: buildProduct({ inStock: false }) },
      on: { whatsappRequested: onWhatsappRequested },
    });

    const button = screen.getByRole('button', { name: 'Consultar por WhatsApp' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    const describedById = button.getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedById}`)?.textContent).toContain('Agotado');

    fireEvent.click(button);
    expect(onWhatsappRequested).not.toHaveBeenCalled();
  });

  it('W10: the WhatsApp button stays enabled even when the selection cap is reached', async () => {
    await render(ProductDetailContent, {
      inputs: { product: buildProduct(), selectionDisabled: true },
    });

    expect(screen.getByRole('button', { name: 'Consultar por WhatsApp' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('W9: the quantity resets to 1 after adding and when navigating to a different product', async () => {
    const onAdd = vi.fn();
    const { rerender, fixture } = await render(ProductDetailContent, {
      inputs: { product: buildProduct() },
      on: { addToSelection: onAdd },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la selección' }));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
    await rerender({ inputs: { product: buildProduct({ id: 'p2', slug: 'otro-producto' }) } });
    // El reinicio al cambiar de producto ocurre en un `effect()`, que no
    // flushea de forma síncrona con el cambio del input: hay que esperar a
    // que la app se estabilice antes de leer el valor.
    await fixture.whenStable();

    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
  });
});
