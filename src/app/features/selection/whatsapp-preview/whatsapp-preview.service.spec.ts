import { TestBed } from '@angular/core/testing';
import { WhatsAppSelectionLine } from '../whatsapp-template/whatsapp-template.model';
import { WhatsAppPreviewService } from './whatsapp-preview.service';

function buildLine(overrides: Partial<WhatsAppSelectionLine> = {}): WhatsAppSelectionLine {
  return {
    name: 'Aceite esencial de lavanda 30ml',
    sku: 'ACE-001',
    slug: 'aceite-esencial-de-lavanda-30ml',
    price: 25,
    effectivePrice: 20,
    currency: 'USD',
    discountPercentage: 20,
    quantity: 1,
    ...overrides,
  };
}

describe('WhatsAppPreviewService', () => {
  function create(): WhatsAppPreviewService {
    TestBed.configureTestingModule({});
    return TestBed.inject(WhatsAppPreviewService);
  }

  it('starts closed with no lines', () => {
    const service = create();

    expect(service.open()).toBe(false);
    expect(service.lines()).toEqual([]);
  });

  it('opens with the given lines and return-focus target', () => {
    const service = create();
    const origin = document.createElement('button');
    const line = buildLine();

    service.openWith([line], origin);

    expect(service.open()).toBe(true);
    expect(service.lines()).toEqual([line]);
    expect(service.returnFocusTo()).toBe(origin);
  });

  it('does nothing when opened with an empty list of lines', () => {
    const service = create();

    service.openWith([], null);

    expect(service.open()).toBe(false);
  });

  it('closes without clearing the last shown lines (so the dialog can fade out with content)', () => {
    const service = create();
    service.openWith([buildLine()], null);

    service.close();

    expect(service.open()).toBe(false);
  });
});
