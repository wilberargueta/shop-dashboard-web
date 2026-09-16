import { render, screen } from '@testing-library/angular';
import { ProductPrice } from './product-price';

describe('ProductPrice', () => {
  it('shows the effective price without a discount badge when not on sale', async () => {
    await render(ProductPrice, {
      inputs: { price: 25, effectivePrice: 25, currency: 'USD', onSale: false, discountPercentage: undefined },
    });

    expect(screen.getByText('$25.00')).toBeTruthy();
    expect(screen.queryByText(/precio anterior/i)).toBeNull();
    expect(screen.queryByText(/^-\d+%$/)).toBeNull();
  });

  it('shows list price struck through, effective price and the percentage badge when on sale', async () => {
    await render(ProductPrice, {
      inputs: { price: 25, effectivePrice: 20, currency: 'USD', onSale: true, discountPercentage: 20 },
    });

    const listPrice = screen.getByText('$25.00');
    expect(listPrice.tagName).toBe('S');
    expect(screen.getByText('$20.00')).toBeTruthy();
    expect(screen.getByText('-20%')).toBeTruthy();
    expect(screen.getByText('precio anterior')).toBeTruthy();
  });
});
