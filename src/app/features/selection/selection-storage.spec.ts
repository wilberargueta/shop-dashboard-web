import { SelectionLine } from './selection.model';
import { readStoredSelection, writeStoredSelection } from './selection-storage';

const STORAGE_KEY = 'shop.selection';

function buildLine(overrides: Partial<SelectionLine> = {}): SelectionLine {
  return {
    productId: 'p1',
    slug: 'aceite-esencial-de-lavanda-30ml',
    quantity: 2,
    name: 'Aceite esencial de lavanda 30ml',
    sku: 'ACE-001',
    price: 25,
    effectivePrice: 20,
    currency: 'USD',
    onSale: true,
    discountPercentage: 20,
    inStock: true,
    ...overrides,
  };
}

describe('selection-storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns an empty array when nothing is stored', () => {
    expect(readStoredSelection()).toEqual([]);
  });

  it('round-trips productId, slug and cantidad without the price', () => {
    writeStoredSelection([buildLine()]);

    const raw = sessionStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual([{ productId: 'p1', slug: 'aceite-esencial-de-lavanda-30ml', cantidad: 2 }]);
    expect(raw).not.toContain('effectivePrice');
    expect(raw).not.toContain('25');

    expect(readStoredSelection()).toEqual([{ productId: 'p1', slug: 'aceite-esencial-de-lavanda-30ml', cantidad: 2 }]);
  });

  it('treats corrupted JSON as an empty selection', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not valid json');

    expect(readStoredSelection()).toEqual([]);
  });

  it('treats a non-array payload as an empty selection', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ productId: 'p1' }));

    expect(readStoredSelection()).toEqual([]);
  });

  it('drops entries with missing or malformed fields instead of throwing', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { productId: 'p1', slug: 'ok', cantidad: 2 },
        { productId: 'p2', slug: 'bad-cantidad', cantidad: 'two' },
        { productId: 'p3', cantidad: 1 },
        { slug: 'no-id', cantidad: 1 },
        { productId: 'p4', slug: 'zero-cantidad', cantidad: 0 },
        null,
        'garbage',
      ]),
    );

    expect(readStoredSelection()).toEqual([{ productId: 'p1', slug: 'ok', cantidad: 2 }]);
  });
});
