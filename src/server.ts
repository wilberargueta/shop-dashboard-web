import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import { buildRobotsTxt } from './server/seo/robots-txt.builder';
import { buildSitemapXml } from './server/seo/sitemap-xml.builder';
import { getCachedSitemapXml } from './server/seo/sitemap-cache';
import { fetchPublishedProductSlugs } from './server/seo/sitemap-slugs';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Sin esto, el servidor sirve el JS/CSS/HTML tal cual, sin `Content-Encoding`
 * (verificado con `curl -H "Accept-Encoding: gzip"`, sin cabecera de vuelta).
 * `PROJECT_SPEC.md §10` mide el JS inicial "comprimido" — el 113 KB que
 * reporta `pnpm build` es solo la estimación de la CLI, no algo que el
 * servidor real aplicara. Bug real encontrado al correr Lighthouse contra
 * este servidor con el backend real levantado (W14): sin compresión, LCP
 * caía a ~3.6s bajo la simulación de 4G (Rendimiento 83, por debajo del 90
 * objetivo) porque el navegador descargaba los ~400 KB sin comprimir de los
 * bundles iniciales, no los ~114 KB documentados.
 */
app.use(compression());

// Mismas variables que ya lee app.config.server.ts — sin nombres nuevos.
const siteUrl = process.env['SITE_URL'] ?? 'http://localhost:4200';
const apiBaseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:8080';

/**
 * `/robots.txt` y `/sitemap.xml` (W11): rutas técnicas, nunca pasan por
 * `AngularNodeAppEngine` — no son componentes ni tienen `RenderMode` en
 * `app.routes.server.ts`. `/sitemap.xml` se cachea 1 hora en memoria
 * (PROJECT_SPEC.md §9).
 */
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(buildRobotsTxt(siteUrl));
});

app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const xml = await getCachedSitemapXml(async () => {
      const slugs = await fetchPublishedProductSlugs(apiBaseUrl);
      return buildSitemapXml(siteUrl, slugs);
    });
    res.type('application/xml').send(xml);
  } catch (error) {
    next(error);
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
