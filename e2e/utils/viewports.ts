/**
 * Anchos de verificación de PROJECT_SPEC.md §11. Un solo lugar, reutilizado
 * por todos los specs responsive — es lo que evita repetir el mismo test
 * seis veces (ROADMAP.md W13).
 */
export const RESPONSIVE_WIDTHS = [320, 375, 768, 1024, 1280, 1920] as const;

export const MOBILE_LANDSCAPE = { width: 740, height: 360 } as const;

/** Breakpoint `lg` de docs/ARQUITECTURA.md §8 — desde aquí el panel de filtros deja de ser un overlay. */
export const DESKTOP_BREAKPOINT = 1024;
