import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { PublicCatalogControllerService } from './api/api/public-catalog-controller.service';
import { MAX_SELECTION } from './core/config/max-selection.token';
import { App } from './app';

describe('App', () => {
  beforeEach(() => sessionStorage.clear());

  it('renders the router outlet without throwing', async () => {
    const { container } = await render(App, {
      providers: [
        provideRouter([]),
        { provide: PublicCatalogControllerService, useValue: { getProduct: vi.fn() } },
        { provide: MAX_SELECTION, useValue: 20 },
      ],
    });

    expect(container.hasAttribute('ng-version')).toBe(true);
  });
});
