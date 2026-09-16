import { render, screen, fireEvent } from '@testing-library/angular';
import { SelectionBar } from './selection-bar';

describe('SelectionBar', () => {
  it('shows the singular count, total and both action buttons', async () => {
    await render(SelectionBar, { inputs: { count: 1, subtotal: 20, currency: 'USD' } });

    expect(screen.getByText('1 producto')).toBeTruthy();
    expect(screen.getByText('20,00 US$')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeTruthy();
  });

  it('shows the plural count for more than one product', async () => {
    await render(SelectionBar, { inputs: { count: 3, subtotal: 65, currency: 'USD' } });

    expect(screen.getByText('3 productos')).toBeTruthy();
  });

  it('emits viewRequested and sendRequested from real, keyboard-operable buttons', async () => {
    const onView = vi.fn();
    const onSend = vi.fn();
    await render(SelectionBar, {
      inputs: { count: 1, subtotal: 20, currency: 'USD' },
      on: { viewRequested: onView, sendRequested: onSend },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
