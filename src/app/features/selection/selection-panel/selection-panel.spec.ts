import { render, screen, fireEvent } from '@testing-library/angular';
import { SelectionLine } from '../selection.model';
import { SelectionPanel } from './selection-panel';

function buildLine(overrides: Partial<SelectionLine> = {}): SelectionLine {
  return {
    productId: 'p1',
    slug: 'aceite-esencial-de-lavanda-30ml',
    quantity: 2,
    name: 'Aceite esencial de lavanda 30ml',
    sku: 'ACE-001',
    price: 25,
    effectivePrice: 20,
    currency: 'USD',
    onSale: true,
    discountPercentage: 20,
    inStock: true,
    ...overrides,
  };
}

describe('SelectionPanel', () => {
  it('renders as a labelled dialog with one item per line', async () => {
    await render(SelectionPanel, {
      inputs: { lines: [buildLine()], subtotal: 40, currency: 'USD', returnFocusTo: null },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy as string)?.textContent).toContain('Tu selección');
    expect(screen.getByText('Aceite esencial de lavanda 30ml')).toBeTruthy();
    expect(screen.getByText('$40.00')).toBeTruthy();
  });

  it('emits quantityChange with the productId when a line quantity changes', async () => {
    const onQuantityChange = vi.fn();
    await render(SelectionPanel, {
      inputs: { lines: [buildLine()], subtotal: 40, currency: 'USD', returnFocusTo: null },
      on: { quantityChange: onQuantityChange },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));

    expect(onQuantityChange).toHaveBeenCalledWith({ productId: 'p1', quantity: 3 });
  });

  it('emits remove with the productId, with a distinguishable accessible name per line', async () => {
    const onRemove = vi.fn();
    await render(SelectionPanel, {
      inputs: {
        lines: [buildLine(), buildLine({ productId: 'p2', name: 'Jabón artesanal de avena' })],
        subtotal: 60,
        currency: 'USD',
        returnFocusTo: null,
      },
      on: { remove: onRemove },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Jabón artesanal de avena de la selección' }));

    expect(onRemove).toHaveBeenCalledWith('p2');
  });

  it('emits sendRequested from the footer button', async () => {
    const onSend = vi.fn();
    await render(SelectionPanel, {
      inputs: { lines: [buildLine()], subtotal: 40, currency: 'USD', returnFocusTo: null },
      on: { sendRequested: onSend },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('emits closed on Escape, on the close button and on backdrop click', async () => {
    const onClosed = vi.fn();
    const { container } = await render(SelectionPanel, {
      inputs: { lines: [buildLine()], subtotal: 40, currency: 'USD', returnFocusTo: null },
      on: { closed: onClosed },
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClosed).toHaveBeenCalledTimes(2);

    const backdrop = container.querySelector('.selection-panel__backdrop');
    if (!backdrop) {
      throw new Error('backdrop not found');
    }
    fireEvent.click(backdrop);
    expect(onClosed).toHaveBeenCalledTimes(3);
  });

  it('traps focus inside the dialog on mount and returns it to the given origin on close', async () => {
    const origin = document.createElement('button');
    document.body.appendChild(origin);

    const { fixture } = await render(SelectionPanel, {
      inputs: { lines: [buildLine()], subtotal: 40, currency: 'USD', returnFocusTo: origin },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await fixture.whenStable();
    fixture.destroy();

    expect(document.activeElement).toBe(origin);
    origin.remove();
  });
});
