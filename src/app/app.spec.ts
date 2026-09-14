import { render, screen } from '@testing-library/angular';
import { App } from './app';

describe('App', () => {
  it('renders the app root', async () => {
    await render(App);

    expect(screen.getByText(/shop-dashboard-web/i)).toBeTruthy();
  });
});
