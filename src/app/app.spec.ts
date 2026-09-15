import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { App } from './app';

describe('App', () => {
  it('renders the router outlet without throwing', async () => {
    const { container } = await render(App, { providers: [provideRouter([])] });

    expect(container.hasAttribute('ng-version')).toBe(true);
  });
});
