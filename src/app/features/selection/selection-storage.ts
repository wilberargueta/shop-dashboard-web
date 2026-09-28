import { SelectionLine, StoredSelectionLine } from './selection.model';

const STORAGE_KEY = 'shop.selection';

function isStoredSelectionLine(value: unknown): value is StoredSelectionLine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['productId'] === 'string' &&
    candidate['productId'].length > 0 &&
    typeof candidate['slug'] === 'string' &&
    candidate['slug'].length > 0 &&
    typeof candidate['cantidad'] === 'number' &&
    Number.isFinite(candidate['cantidad']) &&
    candidate['cantidad'] > 0
  );
}

/**
 * Lee la selección guardada. Cualquier JSON ausente, corrupto o con forma
 * inesperada se trata como "sin selección" — nunca lanza (mismo criterio que
 * `parseCatalogFilters`, W2, para parámetros de URL basura).
 */
export function readStoredSelection(): StoredSelectionLine[] {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredSelectionLine) : [];
  } catch {
    return [];
  }
}

/** Nunca escribe el precio: solo lo que `CLAUDE.md` autoriza a persistir, más `slug`. */
export function writeStoredSelection(lines: readonly SelectionLine[]): void {
  const stored: StoredSelectionLine[] = lines.map((line) => ({
    productId: line.productId,
    slug: line.slug,
    cantidad: line.quantity,
  }));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}
