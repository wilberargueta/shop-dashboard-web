import { TestBed } from '@angular/core/testing';
import { SITE_URL } from '../../../core/config/site-url.token';
import golden from '../../../../test/fixtures/whatsapp-golden.json';
import type { WhatsAppSelectionLine, WhatsAppTemplateSet } from './whatsapp-template.model';
import { WhatsAppTemplateService } from './whatsapp-template.service';

/**
 * Caso 12 de `PROJECT_SPEC.md` §15: recorre `whatsapp-golden.json` (publicado
 * por `shop-backend-service`, tarea B11 — ver `docs/ARQUITECTURA.md` §6 "Dos
 * implementaciones, un solo resultado") y comprueba que este servicio
 * produce el mismo texto que la implementación del backend, caso por caso.
 * Si difiere, una de las dos implementaciones está mal.
 */

const SITE = 'https://tienda.com';

interface GoldenProduct {
  product: string;
  price: number;
  listPrice: number;
  quantity: number;
  url: string;
  sku: string;
  discountPercentage: number;
  currency: string;
}

interface GoldenCase {
  name: string;
  description: string;
  templateType: 'single' | 'multi';
  template?: string;
  templateHeader?: string;
  templateItem?: string;
  templateFooter?: string;
  products: GoldenProduct[];
  expected: string;
}

interface GoldenFixture {
  storeName: string;
  date: string;
  cases: GoldenCase[];
}

// El JSON tiene formas distintas por caso (single vs. multi): se tipa a mano
// en vez de dejar que TypeScript infiera una unión estricta por elemento.
const fixture = golden as GoldenFixture;

/** `whatsapp-golden.json` usa `price`/`listPrice` para el precio efectivo/de lista — al revés que `WhatsAppSelectionLine`, que llama `price` al de lista. */
function toLine(product: GoldenProduct): WhatsAppSelectionLine {
  return {
    name: product.product,
    sku: product.sku,
    slug: product.url.split('/p/')[1] ?? product.url,
    price: product.listPrice,
    effectivePrice: product.price,
    currency: product.currency,
    discountPercentage: product.discountPercentage,
    quantity: product.quantity,
  };
}

function toDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

describe('WhatsAppTemplateService — whatsapp-golden.json (caso 12)', () => {
  let service: WhatsAppTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: SITE_URL, useValue: SITE }] });
    service = TestBed.inject(WhatsAppTemplateService);
  });

  it('has at least one case to run', () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const testCase of fixture.cases) {
    it(`matches the backend for "${testCase.name}": ${testCase.description}`, () => {
      const lines = testCase.products.map(toLine);
      const templates: WhatsAppTemplateSet = {
        single: testCase.template ?? '',
        multiHeader: testCase.templateHeader ?? '',
        multiItem: testCase.templateItem ?? '',
        multiFooter: testCase.templateFooter ?? '',
      };

      const message = service.renderMessage(lines, templates, {
        storeName: fixture.storeName,
        now: toDate(fixture.date),
      });

      expect(message).toBe(testCase.expected);
    });
  }
});
