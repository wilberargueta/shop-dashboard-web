/**
 * Misma escala que `src/styles/_breakpoints.scss`, en TypeScript, para el
 * único consumidor que hoy necesita los mismos números fuera de CSS
 * (`ProductCard.imageSizes`). Fuente: docs/ARQUITECTURA.md §8.
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;
