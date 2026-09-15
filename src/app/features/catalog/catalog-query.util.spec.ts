import { convertToParamMap } from '@angular/router';
import { DEFAULT_CATALOG_FILTERS, DEFAULT_CATALOG_PAGE } from './catalog-query.model';
import { parseCatalogFilters, parseCatalogPage } from './catalog-query.util';

describe('parseCatalogFilters', () => {
  it('returns all defaults when no params are present', () => {
    expect(parseCatalogFilters(convertToParamMap({}))).toEqual(DEFAULT_CATALOG_FILTERS);
  });

  describe('q', () => {
    it('trims a valid search term', () => {
      expect(parseCatalogFilters(convertToParamMap({ q: '  lavanda  ' })).q).toBe('lavanda');
    });

    it('treats an empty or whitespace-only value as absent', () => {
      expect(parseCatalogFilters(convertToParamMap({ q: '' })).q).toBeNull();
      expect(parseCatalogFilters(convertToParamMap({ q: '   ' })).q).toBeNull();
    });
  });

  describe('categories', () => {
    it('collects repeated category params', () => {
      const params = convertToParamMap({ category: ['aceites', 'cremas'] });
      expect(parseCatalogFilters(params).categories).toEqual(['aceites', 'cremas']);
    });

    it('is empty when the param is absent', () => {
      expect(parseCatalogFilters(convertToParamMap({})).categories).toEqual([]);
    });

    it('is empty when the param is present but blank', () => {
      expect(parseCatalogFilters(convertToParamMap({ category: '' })).categories).toEqual([]);
    });
  });

  describe('minPrice / maxPrice', () => {
    it('parses a valid non-negative decimal', () => {
      const filters = parseCatalogFilters(convertToParamMap({ minPrice: '10.5', maxPrice: '50' }));
      expect(filters.minPrice).toBe(10.5);
      expect(filters.maxPrice).toBe(50);
    });

    it('ignores a non-numeric value', () => {
      expect(parseCatalogFilters(convertToParamMap({ minPrice: 'abc' })).minPrice).toBeNull();
    });

    it('ignores a value that is numeric-looking but not fully numeric', () => {
      expect(parseCatalogFilters(convertToParamMap({ minPrice: '12abc' })).minPrice).toBeNull();
    });

    it('ignores an empty string instead of treating it as zero', () => {
      expect(parseCatalogFilters(convertToParamMap({ minPrice: '' })).minPrice).toBeNull();
    });

    it('ignores a negative value', () => {
      expect(parseCatalogFilters(convertToParamMap({ minPrice: '-5' })).minPrice).toBeNull();
    });
  });

  describe('onSale / inStock', () => {
    it('parses literal true/false', () => {
      const filters = parseCatalogFilters(convertToParamMap({ onSale: 'true', inStock: 'false' }));
      expect(filters.onSale).toBe(true);
      expect(filters.inStock).toBe(false);
    });

    it('ignores any other value', () => {
      expect(parseCatalogFilters(convertToParamMap({ onSale: '1' })).onSale).toBeNull();
      expect(parseCatalogFilters(convertToParamMap({ inStock: 'yes' })).inStock).toBeNull();
    });
  });

  describe('sort', () => {
    it('accepts every whitelisted value, including featured', () => {
      for (const sort of ['name,asc', 'name,desc', 'price,asc', 'price,desc', 'newest', 'relevance', 'featured']) {
        expect(parseCatalogFilters(convertToParamMap({ sort })).sort).toBe(sort);
      }
    });

    it('falls back to featured for an invented value', () => {
      expect(parseCatalogFilters(convertToParamMap({ sort: 'SORT_BY_PRICE' })).sort).toBe('featured');
    });
  });
});

describe('parseCatalogPage', () => {
  it('returns defaults when no params are present', () => {
    expect(parseCatalogPage(convertToParamMap({}))).toEqual(DEFAULT_CATALOG_PAGE);
  });

  describe('page', () => {
    it('parses a valid non-negative integer', () => {
      expect(parseCatalogPage(convertToParamMap({ page: '3' })).page).toBe(3);
    });

    it('falls back to 0 for a negative value', () => {
      expect(parseCatalogPage(convertToParamMap({ page: '-5' })).page).toBe(0);
    });

    it('falls back to 0 for a non-integer value', () => {
      expect(parseCatalogPage(convertToParamMap({ page: '2.5' })).page).toBe(0);
    });

    it('falls back to 0 for a non-numeric value', () => {
      expect(parseCatalogPage(convertToParamMap({ page: 'abc' })).page).toBe(0);
    });
  });

  describe('size', () => {
    it('is null when absent', () => {
      expect(parseCatalogPage(convertToParamMap({})).size).toBeNull();
    });

    it('is null for a non-numeric value', () => {
      expect(parseCatalogPage(convertToParamMap({ size: 'lots' })).size).toBeNull();
    });

    it('passes through a value within range', () => {
      expect(parseCatalogPage(convertToParamMap({ size: '24' })).size).toBe(24);
    });

    it('clamps a value above the maximum', () => {
      expect(parseCatalogPage(convertToParamMap({ size: '999' })).size).toBe(48);
    });

    it('clamps a value below the minimum', () => {
      expect(parseCatalogPage(convertToParamMap({ size: '0' })).size).toBe(1);
    });
  });
});

describe('garbage everywhere', () => {
  it('falls back to all defaults without throwing', () => {
    const params = convertToParamMap({
      sort: 'bogus',
      minPrice: 'abc',
      maxPrice: 'xyz',
      onSale: '1',
      inStock: 'nope',
      category: '',
      page: '-99',
      size: 'lots',
    });

    expect(() => parseCatalogFilters(params)).not.toThrow();
    expect(() => parseCatalogPage(params)).not.toThrow();
    expect(parseCatalogFilters(params)).toEqual(DEFAULT_CATALOG_FILTERS);
    expect(parseCatalogPage(params)).toEqual(DEFAULT_CATALOG_PAGE);
  });
});
