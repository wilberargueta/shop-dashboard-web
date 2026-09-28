import { render } from '@testing-library/angular';
import { ProductDetailSkeleton } from './product-detail-skeleton';

describe('ProductDetailSkeleton', () => {
  it('renders as a decorative placeholder, hidden from assistive tech', async () => {
    const { container } = await render(ProductDetailSkeleton);

    expect(container.querySelector('.product-detail-skeleton')).toBeTruthy();
    expect(container.getAttribute('aria-hidden')).toBe('true');
  });
});
