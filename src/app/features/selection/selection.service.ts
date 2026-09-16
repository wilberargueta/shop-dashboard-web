import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';
import { PublicCatalogControllerService } from '../../api/api/public-catalog-controller.service';
import { ProductCard as ProductCardDto } from '../../api/model/product-card';
import { ProductDetail } from '../../api/model/product-detail';
import { MAX_SELECTION } from '../../core/config/max-selection.token';
import { readStoredSelection, writeStoredSelection } from './selection-storage';
import { SelectionLine } from './selection.model';

type SelectableProduct = ProductCardDto | ProductDetail;

function toSelectionLine(product: SelectableProduct, quantity: number): SelectionLine | null {
  if (!product.id || !product.slug) {
    return null;
  }
  return {
    productId: product.id,
    slug: product.slug,
    quantity,
    name: product.name ?? '',
    sku: product.sku ?? '',
    price: product.price ?? 0,
    effectivePrice: product.effectivePrice ?? product.price ?? 0,
    currency: product.currency ?? 'USD',
    onSale: product.onSale ?? false,
    discountPercentage: product.discountPercentage,
    inStock: product.inStock ?? true,
    primaryImage: product.primaryImage,
  };
}

/**
 * Selección múltiple del visitante (PROJECT_SPEC.md §7). Persistida en
 * `sessionStorage` guardando solo `{ productId, slug, cantidad }` — nunca el
 * precio (CLAUDE.md): al restaurar, cada línea se vuelve a pedir a la API
 * (caso 29, crítico) y las que ya no están publicadas desaparecen en
 * silencio (caso 30).
 *
 * `slug` se persiste además de `productId` porque la API pública no tiene
 * forma de buscar un producto por id ni en lote — solo `getProduct({slug})`
 * y `listProducts()` sin filtro por id. El backend ya tiene anotada la tarea
 * B8.1 ("Filtro `ids` en el listado público") para resolver esto con una
 * sola petición; en cuanto exista y se regenere el cliente, este restore se
 * puede simplificar a una llamada a `listProducts({ids})` y `slug` deja de
 * hacer falta en el storage.
 */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly publicCatalogController = inject(PublicCatalogControllerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly maxSelection = inject(MAX_SELECTION);

  private readonly linesSignal = signal<readonly SelectionLine[]>([]);
  private readonly restoringSignal = signal(false);
  private readonly panelOpenSignal = signal(false);
  private readonly panelReturnFocusToSignal = signal<HTMLElement | null>(null);

  readonly lines = this.linesSignal.asReadonly();
  readonly isRestoring = this.restoringSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();
  readonly panelReturnFocusTo = this.panelReturnFocusToSignal.asReadonly();

  readonly count = computed(() => this.linesSignal().length);
  readonly totalUnits = computed(() => this.linesSignal().reduce((sum, line) => sum + line.quantity, 0));
  readonly subtotal = computed(() =>
    this.linesSignal().reduce((sum, line) => sum + line.effectivePrice * line.quantity, 0),
  );
  /** Catálogo de una sola moneda (ARQUITECTURA.md §4.2: `currency` siempre `USD` por ahora). */
  readonly currency = computed(() => this.linesSignal()[0]?.currency);
  readonly capReached = computed(() => this.linesSignal().length >= this.maxSelection);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.restoreFromStorage();
    }

    // No se ejecuta en servidor (`isPlatformBrowser` en la guarda) ni
    // mientras un restore está en vuelo, para no pisar el storage con una
    // lista todavía vacía antes de que lleguen los datos refrescados.
    effect(() => {
      const lines = this.linesSignal();
      if (this.restoringSignal() || !isPlatformBrowser(this.platformId)) {
        return;
      }
      untracked(() => writeStoredSelection(lines));
    });
  }

  isSelected(productId: string): boolean {
    return this.linesSignal().some((line) => line.productId === productId);
  }

  /**
   * `false` si el producto no tiene `id`/`slug`, o si es una línea nueva y el
   * tope (`catalog.max_selection`) ya está alcanzado. Añadir cantidad a una
   * línea ya seleccionada nunca cuenta contra el tope.
   */
  add(product: SelectableProduct, quantity = 1): boolean {
    if (!product.id) {
      return false;
    }
    const existing = this.linesSignal().find((line) => line.productId === product.id);
    if (existing) {
      this.setQuantity(existing.productId, existing.quantity + quantity);
      return true;
    }
    if (this.linesSignal().length >= this.maxSelection) {
      return false;
    }
    const line = toSelectionLine(product, Math.max(1, Math.trunc(quantity)));
    if (!line) {
      return false;
    }
    this.linesSignal.update((lines) => [...lines, line]);
    return true;
  }

  remove(productId: string): void {
    this.linesSignal.update((lines) => lines.filter((line) => line.productId !== productId));
  }

  setQuantity(productId: string, quantity: number): void {
    const normalized = Math.max(1, Math.trunc(quantity));
    this.linesSignal.update((lines) =>
      lines.map((line) => (line.productId === productId ? { ...line, quantity: normalized } : line)),
    );
  }

  /** Añade si no estaba seleccionado, quita si ya lo estaba. Mismo resultado booleano que `add()`. */
  toggle(product: SelectableProduct): boolean {
    if (!product.id) {
      return false;
    }
    if (this.isSelected(product.id)) {
      this.remove(product.id);
      return true;
    }
    return this.add(product);
  }

  clear(): void {
    this.linesSignal.set([]);
  }

  openPanel(returnFocusTo: HTMLElement | null = null): void {
    this.panelReturnFocusToSignal.set(returnFocusTo);
    this.panelOpenSignal.set(true);
  }

  closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  /**
   * Fan-out de una sola vez al construir el servicio, no un fetch reactivo:
   * `forkJoin` + `catchError` por petición (no `resource()`/`rxResource()`)
   * para que el fallo de una línea (404 de un producto despublicado, o
   * cualquier otro error) se resuelva a `null` y no aborte las demás. No hay
   * valor de reserva seguro para una línea que falla — el caso 29 prohíbe
   * mostrar un precio no verificado — así que se descarta ante cualquier
   * fallo, no solo ante 404.
   */
  private restoreFromStorage(): void {
    const stored = readStoredSelection().slice(0, this.maxSelection);
    if (stored.length === 0) {
      return;
    }
    this.restoringSignal.set(true);
    const requests = stored.map((storedLine) =>
      this.publicCatalogController.getProduct({ slug: storedLine.slug }).pipe(
        map((detail) => toSelectionLine(detail, storedLine.cantidad)),
        catchError(() => of(null)),
      ),
    );
    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        this.linesSignal.set(results.filter((line): line is SelectionLine => line !== null));
        this.restoringSignal.set(false);
      });
  }
}
