import { render, screen } from '@testing-library/angular';
import { QuantityStepper } from './quantity-stepper';

describe('QuantityStepper', () => {
  it('starts at the given quantity', async () => {
    await render(QuantityStepper, { inputs: { quantity: 3 } });

    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3');
  });

  it('increments and decrements the quantity', async () => {
    const { fixture } = await render(QuantityStepper, { inputs: { quantity: 1 } });

    screen.getByRole('button', { name: 'Aumentar cantidad' }).click();
    fixture.detectChanges();
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('2');

    screen.getByRole('button', { name: 'Disminuir cantidad' }).click();
    fixture.detectChanges();
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
  });

  it('blocks decrementing below the minimum with an accessible explanation, never the disabled attribute', async () => {
    const { container } = await render(QuantityStepper, { inputs: { quantity: 1, min: 1 } });

    const button = screen.getByRole('button', { name: 'Disminuir cantidad' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);

    const describedById = button.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    expect(container.querySelector(`#${describedById}`)?.textContent).toContain('Cantidad mínima');
  });

  it('disables everything with an accessible explanation when out of stock', async () => {
    const { fixture, container } = await render(QuantityStepper, { inputs: { quantity: 2, disabled: true } });

    const increment = screen.getByRole('button', { name: 'Aumentar cantidad' });
    expect(increment.getAttribute('aria-disabled')).toBe('true');

    increment.click();
    fixture.detectChanges();
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('2');

    const describedById = increment.getAttribute('aria-describedby');
    expect(container.querySelector(`#${describedById}`)?.textContent).toContain('Agotado');
  });
});
