import { provideRouter } from '@angular/router';
import { DeferBlockState } from '@angular/core/testing';
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
    // `@defer (when whatsappPreview.open())` no resuelve de forma fiable con
    // el disparador real en jsdom — mismo criterio que
    // `catalog-filter-mobile-panel.spec.ts` (W5).
    deferBlockStates: DeferBlockState.Complete,
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

  afterEach(() => {
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
  });

  it('sets Organization JSON-LD once, app-wide (W11)', async () => {
    await renderApp();

    const jsonLd = JSON.parse(document.querySelector('script#ld-organization')?.textContent ?? '{}');
    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Mi Tienda',
      url: 'http://localhost:4200',
    });
  });

  it('renders the router outlet without throwing', async () => {
    const { container } = await renderApp();

    expect(container.hasAttribute('ng-version')).toBe(true);
  });

  it('renders a skip-to-content link pointing at #main-content (PROJECT_SPEC.md §12)', async () => {
    const { getByRole } = await renderApp();

    const skipLink = getByRole('link', { name: 'Saltar al contenido' });
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  it('makes the router outlet inert while the WhatsApp preview dialog is open, and un-inert once closed', async () => {
    const { container, fixture } = await renderApp();
    const outletWrapper = container.querySelector('div');
    expect(outletWrapper?.hasAttribute('inert')).toBe(false);

    const whatsappPreview = fixture.debugElement.injector.get(WhatsAppPreviewService);
    whatsappPreview.openWith([{ name: 'x', sku: 'x', slug: 'x', price: 1, effectivePrice: 1, currency: 'USD', quantity: 1 }], null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(outletWrapper?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    /**
     * Hallazgo real: `@defer (when whatsappPreview.open())` es un disparador
     * de una sola vez (semántica documentada de Angular) — carga el bloque
     * la primera vez que la condición es verdadera, pero nunca lo retira
     * cuando vuelve a ser falsa. Sin un `@if` reactivo dentro del `@defer`
     * (`app.html`), el diálogo se quedaba montado para siempre tras la
     * primera apertura y "Cerrar" no hacía nada visible. Mismo patrón que ya
     * usa `catalog-filter-mobile-panel.html` para el mismo problema.
     */
    whatsappPreview.close();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(outletWrapper?.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
