import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { WHATSAPP_SETTINGS, WhatsAppSettings } from '../../core/config/whatsapp-settings.token';
import { SiteHeader } from './site-header';

const SETTINGS: WhatsAppSettings = {
  phoneNumber: '50370000000',
  storeName: "Gabys Beauty's Store",
  templates: { single: '', multiHeader: '', multiItem: '', multiFooter: '' },
};

describe('SiteHeader', () => {
  it('shows the store name as a link back to the catalog, inside a banner landmark', async () => {
    await render(SiteHeader, {
      providers: [provideRouter([]), { provide: WHATSAPP_SETTINGS, useValue: SETTINGS }],
    });

    expect(screen.getByRole('banner')).toBeTruthy();
    const brand = screen.getByRole('link', { name: "Gabys Beauty's Store" });
    expect(brand.getAttribute('href')).toBe('/');
  });
});
