/**
 * Estático salvo por el dominio (que cambia por entorno vía `SITE_URL`), así
 * que se sirve como ruta dinámica de Express en vez de un archivo estático en
 * `public/` — un archivo estático no podría llevar el `Sitemap:` absoluto
 * correcto en dev/prod (PROJECT_SPEC.md §9: "permite todo salvo rutas con
 * parámetros de filtro").
 */
export function buildRobotsTxt(siteUrl: string): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /*?', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}
