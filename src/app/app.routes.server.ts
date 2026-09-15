import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // `/` depende de filtros por query param y de datos en vivo del backend
  // (PROJECT_SPEC.md §8): no se puede prerenderizar en build, cada petición
  // necesita su propio render en servidor.
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
