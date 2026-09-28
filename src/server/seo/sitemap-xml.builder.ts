function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(loc: string): string {
  return `<url><loc>${escapeXml(loc)}</loc></url>`;
}

/**
 * Solo `/` + un `<url>` por producto publicado (`/p/:slug`) — sin URLs de
 * categoría: no hay ruta de categoría propia en `app.routes.ts` (son filtros
 * de query string en `/`, que `robots.txt` ya excluye con `Disallow: /*?`
 * por ser contenido duplicado). Decisión tomada con el usuario, documentada
 * como desviación de una ambigüedad de `PROJECT_SPEC.md` §9.
 */
export function buildSitemapXml(siteUrl: string, slugs: readonly string[]): string {
  const urls = [urlEntry(`${siteUrl}/`), ...slugs.map((slug) => urlEntry(`${siteUrl}/p/${slug}`))].join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
