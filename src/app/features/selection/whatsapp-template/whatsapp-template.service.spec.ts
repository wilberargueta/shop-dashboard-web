import { TestBed } from '@angular/core/testing';
import { SITE_URL } from '../../../core/config/site-url.token';
import type { WhatsAppSelectionLine, WhatsAppTemplateSet } from './whatsapp-template.model';
import { WhatsAppTemplateService } from './whatsapp-template.service';

const SITE = 'https://tienda.test';

function buildLine(overrides: Partial<WhatsAppSelectionLine> = {}): WhatsAppSelectionLine {
  return {
    name: 'Aceite esencial de lavanda 30ml',
    sku: 'ACE-001',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 20,
    currency: 'USD',
    discountPercentage: 20,
    quantity: 2,
    ...overrides,
  };
}

function buildTemplates(overrides: Partial<WhatsAppTemplateSet> = {}): WhatsAppTemplateSet {
  return {
    single: '{{producto}}',
    multiHeader: 'Header',
    multiItem: '{{producto}}',
    multiFooter: 'Footer',
    ...overrides,
  };
}

const ALL_PRODUCT_MARKERS_TEMPLATE =
  '{{producto}}|{{precio}}|{{cantidad}}|{{url}}|{{sku}}|{{precio_lista}}|{{descuento}}|{{subtotal}}|{{moneda}}';
const ALL_GLOBAL_MARKERS_TEMPLATE = '{{tienda}}|{{fecha}}|{{total}}|{{items}}|{{unidades}}';

describe('WhatsAppTemplateService', () => {
  let service: WhatsAppTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SITE_URL, useValue: SITE }],
    });
    service = TestBed.inject(WhatsAppTemplateService);
  });

  it('substitutes the 9 per-product markers (case 1)', () => {
    const message = service.renderMessage(
      [buildLine()],
      buildTemplates({ single: ALL_PRODUCT_MARKERS_TEMPLATE }),
      { storeName: 'Mi Tienda' },
    );

    expect(message).toBe(
      [
        'Aceite esencial de lavanda 30ml',
        '$20.00',
        '2',
        `${SITE}/p/aceite-esencial-de-lavanda-30ml`,
        'ACE-001',
        '$25.00',
        '20%',
        '$40.00',
        'USD',
      ].join('|'),
    );
  });

  it('substitutes the 5 global markers (case 2)', () => {
    const line = buildLine({
      price: 10,
      effectivePrice: 10,
      quantity: 3,
      discountPercentage: undefined,
    });

    const message = service.renderMessage(
      [line],
      buildTemplates({ single: ALL_GLOBAL_MARKERS_TEMPLATE }),
      {
        storeName: 'Mi Tienda',
        now: new Date(2026, 8, 12),
      },
    );

    expect(message).toBe('Mi Tienda|12/09/2026|$30.00|1|3');
  });

  it('leaves an unknown marker literal (case 3)', () => {
    const message = service.renderMessage(
      [buildLine()],
      buildTemplates({ single: 'Hola {{inexistente}}' }),
      {
        storeName: 'Mi Tienda',
      },
    );

    expect(message).toBe('Hola {{inexistente}}');
  });

  it('replaces a per-product marker used in a global template with an empty string (case 4)', () => {
    const lines = [buildLine(), buildLine({ name: 'Otro producto' })];

    const message = service.renderMessage(
      lines,
      buildTemplates({ multiHeader: 'H:{{producto}}', multiItem: 'x', multiFooter: 'F:{{sku}}' }),
      { storeName: 'Mi Tienda' },
    );

    expect(message).toBe('H:xxF:');
  });

  it('uses template_single for a single product (case 5)', () => {
    const message = service.renderMessage([buildLine()], buildTemplates({ single: 'UNICO' }), {
      storeName: 'Mi Tienda',
    });

    expect(message).toBe('UNICO');
  });

  it('renders header + one line per product + footer for three products (case 6)', () => {
    const lines = [buildLine({ name: 'A' }), buildLine({ name: 'B' }), buildLine({ name: 'C' })];

    const message = service.renderMessage(
      lines,
      buildTemplates({ multiHeader: 'H\n', multiItem: '- {{producto}}\n', multiFooter: 'F' }),
      { storeName: 'Mi Tienda' },
    );

    expect(message).toBe('H\n- A\n- B\n- C\nF');
  });

  it('the footer total matches the sum of subtotals (case 7)', () => {
    const lines = [
      buildLine({ name: 'A', effectivePrice: 10, quantity: 1 }),
      buildLine({ name: 'B', effectivePrice: 15, quantity: 2 }),
      buildLine({ name: 'C', effectivePrice: 5, quantity: 3 }),
    ];

    const message = service.renderMessage(
      lines,
      buildTemplates({ multiFooter: 'Total: {{total}}' }),
      {
        storeName: 'Mi Tienda',
      },
    );

    expect(message).toContain('Total: $55.00');
  });

  it('subtotal equals effective price times quantity (case 8)', () => {
    const lines = [
      buildLine({ name: 'A' }),
      buildLine({ name: 'B', effectivePrice: 7.5, quantity: 4 }),
    ];

    const message = service.renderMessage(
      lines,
      buildTemplates({ multiItem: '{{producto}}:{{subtotal}} ' }),
      {
        storeName: 'Mi Tienda',
      },
    );

    expect(message).toContain('B:$30.00');
  });

  it('precio usa el precio efectivo, precio_lista el de lista, y descuento es 0% sin descuento activo (case 9)', () => {
    const discounted = buildLine({
      name: 'Con descuento',
      price: 25,
      effectivePrice: 20,
      discountPercentage: 20,
    });
    const notDiscounted = buildLine({
      name: 'Sin descuento',
      price: 10,
      effectivePrice: 10,
      discountPercentage: undefined,
    });

    const message = service.renderMessage(
      [discounted, notDiscounted],
      buildTemplates({ multiItem: '{{producto}}:{{precio}}/{{precio_lista}}/{{descuento}} ' }),
      { storeName: 'Mi Tienda' },
    );

    expect(message).toContain('Con descuento:$20.00/$25.00/20%');
    expect(message).toContain('Sin descuento:$10.00/$10.00/0%');
  });

  it('truncates the item list past 1500 characters and adds "… y N productos más" (case 10)', () => {
    const lines = Array.from({ length: 40 }, (_, i) =>
      buildLine({
        name: `Producto de prueba muy largo número ${i + 1}`,
        sku: `SKU-${i}`,
        quantity: 1,
      }),
    );

    const message = service.renderMessage(
      lines,
      buildTemplates({
        multiHeader: 'Header\n',
        multiItem: '- {{producto}} ({{sku}})\n',
        multiFooter: '\nFooter',
      }),
      { storeName: 'Mi Tienda' },
    );

    expect(message.length).toBeLessThanOrEqual(1500);
    expect(message).toContain('productos más');
    expect(message.startsWith('Header\n')).toBe(true);
    expect(message.endsWith('\nFooter')).toBe(true);
  });

  it('buildWhatsAppUrl encodes &, #, +, tildes, emoji and line breaks correctly (case 11)', () => {
    const message = 'Aceite & crema #1 + envío rápido 🌿\nSegunda línea';

    const url = service.buildWhatsAppUrl('50370000000', message);

    const prefix = 'https://wa.me/50370000000?text=';
    expect(url.startsWith(prefix)).toBe(true);
    expect(decodeURIComponent(url.slice(prefix.length))).toBe(message);
  });

  it('matches the default templates from ARQUITECTURA.md §6 as a smoke test', () => {
    const singleTemplate = [
      '¡Hola! Me interesa este producto de {{tienda}}:',
      '',
      '*{{producto}}*',
      'SKU: {{sku}}',
      'Precio: {{precio}}',
      'Cantidad: {{cantidad}}',
      'Total: {{subtotal}}',
      '',
      '{{url}}',
    ].join('\n');

    const message = service.renderMessage(
      [buildLine()],
      buildTemplates({ single: singleTemplate }),
      {
        storeName: 'Mi Tienda',
      },
    );

    expect(message).toBe(
      [
        '¡Hola! Me interesa este producto de Mi Tienda:',
        '',
        '*Aceite esencial de lavanda 30ml*',
        'SKU: ACE-001',
        'Precio: $20.00',
        'Cantidad: 2',
        'Total: $40.00',
        '',
        `${SITE}/p/aceite-esencial-de-lavanda-30ml`,
      ].join('\n'),
    );
  });
});
