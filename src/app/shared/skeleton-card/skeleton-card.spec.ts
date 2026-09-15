import { render } from '@testing-library/angular';
import { SkeletonCard } from './skeleton-card';

describe('SkeletonCard', () => {
  it('renders as a decorative placeholder, hidden from assistive tech', async () => {
    const { container } = await render(SkeletonCard);

    expect(container.querySelector('.skeleton-card')).toBeTruthy();
    expect(container.getAttribute('aria-hidden')).toBe('true');
  });
});
