import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { PublicCatalogControllerService } from './api/api/public-catalog-controller.service';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { MAX_SELECTION } from './core/config/max-selection.token';
import { SITE_URL } from './core/config/site-url.token';
import { WHATSAPP_SETTINGS, WhatsAppSettings } from './core/config/whatsapp-settings.token';
import { WhatsAppPreviewService } from './features/selection/whatsapp-preview/whatsapp-preview.service';
import { App } from './app';

const WHATSAPP_SETTINGS_VALUE: WhatsAppSettings = {
  phoneNumber: '50370000000',
  storeName: 'Mi Tienda',
  templates: { single: '{{producto}}', multiHeader: '', multiItem: '', multiFooter: '' },
};

function renderApp() {
  return render(App, {
    providers: [
      provideRouter([]),
      { provide: PublicCatalogControllerService, useValue: { getProduct: vi.fn() } },
      { provide: MAX_SELECTION, useValue: 20 },
      { provide: SITE_URL, useValue: 'http://localhost:4200' },
      { provide: API_BASE_URL, useValue: '' },
      { provide: WHATSAPP_SETTINGS, useValue: WHATSAPP_SETTINGS_VALUE },
    ],
  });
}

describe('App', () => {
  beforeEach(() => sessionStorage.clear());

  it('renders the router outlet without throwing', async () => {
    const { container } = await renderApp();

    expect(container.hasAttribute('ng-version')).toBe(true);
  });

  it('makes the router outlet inert while the WhatsApp preview dialog is open', async () => {
    const { container, fixture } = await renderApp();
    const outletWrapper = container.querySelector('div');
    expect(outletWrapper?.hasAttribute('inert')).toBe(false);

    const whatsappPreview = fixture.debugElement.injector.get(WhatsAppPreviewService);
    whatsappPreview.openWith([{ name: 'x', sku: 'x', slug: 'x', price: 1, effectivePrice: 1, currency: 'USD', quantity: 1 }], null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(outletWrapper?.hasAttribute('inert')).toBe(true);
  });
});
