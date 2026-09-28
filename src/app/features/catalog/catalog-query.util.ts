import type { ParamMap } from '@angular/router';
import {
  CATALOG_SORT_VALUES,
  DEFAULT_CATALOG_SORT,
  type CatalogFilters,
  type CatalogPage,
  type CatalogSort,
} from './catalog-query.model';

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 48;

function parseNonNegativeNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseBoolean(raw: string | null): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function parseSort(raw: string | null): CatalogSort {
  return (CATALOG_SORT_VALUES as readonly string[]).includes(raw ?? '')
    ? (raw as CatalogSort)
    : DEFAULT_CATALOG_SORT;
}

export function parseCatalogFilters(params: ParamMap): CatalogFilters {
  const q = params.get('q');
  const trimmedQ = q?.trim();

  return {
    q: trimmedQ ? trimmedQ : null,
    categories: params
      .getAll('category')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    minPrice: parseNonNegativeNumber(params.get('minPrice')),
    maxPrice: parseNonNegativeNumber(params.get('maxPrice')),
    onSale: parseBoolean(params.get('onSale')),
    inStock: parseBoolean(params.get('inStock')),
    sort: parseSort(params.get('sort')),
  };
}

/**
 * Cuenta filtros activos para el contador de "Limpiar filtros"
 * (PROJECT_SPEC.md §4). `sort` no cuenta: es orden, no filtro.
 */
export function countActiveFilters(filters: CatalogFilters): number {
  let count = filters.categories.length;
  if (filters.q !== null) count += 1;
  if (filters.minPrice !== null) count += 1;
  if (filters.maxPrice !== null) count += 1;
  if (filters.onSale !== null) count += 1;
  return count;
}

export function parseCatalogPage(params: ParamMap): CatalogPage {
  const rawPage = params.get('page');
  const page = rawPage === null || rawPage.trim() === '' ? NaN : Number(rawPage);
  const rawSize = params.get('size');
  const size = rawSize === null || rawSize.trim() === '' ? NaN : Number(rawSize);

  return {
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    size: Number.isInteger(size)
      ? Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, size))
      : null,
  };
}
