export const CATALOG_SORT_VALUES = [
  'name,asc',
  'name,desc',
  'price,asc',
  'price,desc',
  'newest',
  'relevance',
  'featured',
] as const;

export type CatalogSort = (typeof CATALOG_SORT_VALUES)[number];

export const DEFAULT_CATALOG_SORT: CatalogSort = 'featured';

export interface CatalogFilters {
  q: string | null;
  categories: readonly string[];
  minPrice: number | null;
  maxPrice: number | null;
  onSale: boolean | null;
  inStock: boolean | null;
  sort: CatalogSort;
}

export interface CatalogPage {
  page: number;
  /** `null` = no fijado en la URL; el backend aplica `catalog.page_size`. */
  size: number | null;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: null,
  categories: [],
  minPrice: null,
  maxPrice: null,
  onSale: null,
  inStock: null,
  sort: DEFAULT_CATALOG_SORT,
};

export const DEFAULT_CATALOG_PAGE: CatalogPage = {
  page: 0,
  size: null,
};
