/**
 * jsdom (el entorno de `pnpm test`) no implementa `IntersectionObserver` —
 * es una API real del navegador, no algo que Vitest deba simular. Sin este
 * stub global, cualquier componente que use `IntersectOnVisible`
 * (`shared/intersection-observer/`) revienta el render en los tests que no
 * necesitan simular una intersección real. `intersect-on-visible.spec.ts`
 * sí la necesita: instala su propio fake más completo y lo restaura
 * después, así que no choca con este stub por defecto.
 */
class NoopIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  observe(): void {
    // No hace falta observar de verdad: nada dispara una intersección aquí.
  }

  unobserve(): void {
    // Idem.
  }

  disconnect(): void {
    // Idem.
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
