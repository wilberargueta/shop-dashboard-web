import { TestBed } from '@angular/core/testing';
import { WHATSAPP_SETTINGS, WhatsAppSettings } from '../config/whatsapp-settings.token';
import { SeoService } from './seo.service';

const WHATSAPP_SETTINGS_VALUE: WhatsAppSettings = {
  phoneNumber: '50370000000',
  storeName: 'Mi Tienda',
  templates: { single: '{{producto}}', multiHeader: '', multiItem: '', multiFooter: '' },
};

describe('SeoService', () => {
  let service: SeoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: WHATSAPP_SETTINGS, useValue: WHATSAPP_SETTINGS_VALUE }],
    });
    service = TestBed.inject(SeoService);
  });

  afterEach(() => {
    document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]').forEach((el) =>
      el.remove(),
    );
  });

  describe('updatePageTags', () => {
    it('sets title, description, Open Graph, Twitter Card and og:site_name', () => {
      service.updatePageTags({
        title: 'Aceite esencial de lavanda 30ml',
        description: 'Relajante, 100% puro',
        url: 'https://tienda.test/p/aceite-esencial-de-lavanda-30ml',
        type: 'product',
        image: 'https://tienda.test/media/p1/detail.webp',
      });

      expect(document.title).toBe('Aceite esencial de lavanda 30ml');
      expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
        'Relajante, 100% puro',
      );
      expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('product');
      expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Mi Tienda');
      expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
        'https://tienda.test/media/p1/detail.webp',
      );
      expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
        'summary_large_image',
      );
      expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
        'https://tienda.test/media/p1/detail.webp',
      );
    });

    it('sets a single canonical link and updates it in place on repeated calls', () => {
      service.updatePageTags({
        title: 'A',
        description: 'A',
        url: 'https://tienda.test/p/a',
        type: 'product',
      });
      service.updatePageTags({
        title: 'B',
        description: 'B',
        url: 'https://tienda.test/p/b',
        type: 'product',
      });

      const canonicals = document.head.querySelectorAll('link[rel="canonical"]');
      expect(canonicals.length).toBe(1);
      expect(canonicals[0].getAttribute('href')).toBe('https://tienda.test/p/b');
    });

    it('removes a stale og:image/twitter:image when the next page has none', () => {
      service.updatePageTags({
        title: 'Con imagen',
        description: 'x',
        url: 'https://tienda.test/p/x',
        type: 'product',
        image: 'https://tienda.test/media/x/detail.webp',
      });
      service.updatePageTags({
        title: 'Catálogo',
        description: 'x',
        url: 'https://tienda.test/',
        type: 'website',
      });

      expect(document.querySelector('meta[property="og:image"]')).toBeNull();
      expect(document.querySelector('meta[name="twitter:image"]')).toBeNull();
    });
  });

  describe('JSON-LD', () => {
    it('creates a script block with the given id and JSON content', () => {
      service.setJsonLd('ld-product', { '@type': 'Product', name: 'Aceite' });

      const script = document.querySelector('script#ld-product');
      expect(script?.getAttribute('type')).toBe('application/ld+json');
      expect(JSON.parse(script?.textContent ?? '{}')).toEqual({ '@type': 'Product', name: 'Aceite' });
    });

    it('updates the same block in place instead of duplicating it', () => {
      service.setJsonLd('ld-product', { '@type': 'Product', name: 'Aceite' });
      service.setJsonLd('ld-product', { '@type': 'Product', name: 'Crema' });

      const scripts = document.head.querySelectorAll('script#ld-product');
      expect(scripts.length).toBe(1);
      expect(JSON.parse(scripts[0].textContent ?? '{}')).toEqual({ '@type': 'Product', name: 'Crema' });
    });

    it('keeps other ids untouched when setting or removing one block', () => {
      service.setJsonLd('ld-product', { '@type': 'Product' });
      service.setJsonLd('ld-itemlist', { '@type': 'ItemList' });

      service.removeJsonLd('ld-product');

      expect(document.querySelector('script#ld-product')).toBeNull();
      expect(document.querySelector('script#ld-itemlist')).not.toBeNull();
    });

    it('removing a non-existent block does not throw', () => {
      expect(() => service.removeJsonLd('ld-organization')).not.toThrow();
    });
  });
});
