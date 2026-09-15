# ROADMAP — tienda-web

Tareas en orden. **Este repo depende del backend**: no empieces hasta que las
tareas B0–B4 de `tienda-backend` estén terminadas y el OpenAPI sea generable.

Marca `[x]` al completar y anota desviaciones.

---

## Fase 0 — Cimientos

### [x] W0. Esqueleto del proyecto con SSR

Crear el proyecto Angular 22 con SSR (`--ssr`), sin zonas, TypeScript estricto
con `strictTemplates`, pnpm, ESLint + Prettier.

Configurar entornos (`dev` apuntando a `http://localhost:8080`, `prod` por
variable). Estructura de carpetas:

```
src/app/
├── core/          servicios transversales, interceptores, guardas de plataforma
├── shared/        componentes reutilizables, pipes, directivas
├── features/
│   ├── catalog/   grid, filtros, tarjeta
│   ├── product/   detalle, modal, carrusel
│   └── selection/ selección múltiple y WhatsApp
├── api/           GENERADO — no editar
└── layout/        cabecera, pie, contenedor
```

Configurar Vitest (o el runner del CLI), Angular Testing Library y Playwright.

**Aceptación:**
- `pnpm build` produce artefactos de navegador y de servidor.
- `pnpm start` levanta con SSR y la página inicial se renderiza en servidor
  (verifícalo con `curl` mirando el HTML, no en el navegador).
- `pnpm test` y `pnpm lint` pasan.
- `strict` y `strictTemplates` están activos.

---

### [ ] W1. Cliente de API generado

Script `pnpm api:generate` que descarga el `openapi.json` del backend y genera
`src/app/api/`. Fijar la versión del generador en `package.json`.
`.gitattributes` marcando la carpeta como generada.
Script de CI que regenera y falla si difiere de lo commiteado.

Interceptor HTTP con: URL base por entorno, cabecera de `traceId` propia y
manejo centralizado de errores traduciendo `ProblemDetail` a un tipo de error
de la aplicación.

**Aceptación:**
- `pnpm api:generate` produce tipos que compilan.
- Un error `429` del backend produce un objeto de error tipado con su
  `Retry-After` accesible.
- Los tipos generados cubren `ProductCard`, `ProductDetail`, `Category` y
  `PublicSettings`.

**Desviaciones:**
- **`PublicSettings` no se generó**: `GET /api/public/v1/settings` todavía no
  existe en el backend — es la tarea `B11` de `tienda-backend`, que va después
  de identidad/admin/imágenes y no está hecha (verificado contra el backend
  real corriendo en `localhost:8080`, commit `d2ffbcc`, con `B0`-`B4` aplicados).
  Por `CLAUDE.md` ("Falta un campo en la API → dilo; el cambio es en el
  backend"), no se ha inventado el tipo a mano. `pnpm api:generate` lo traerá
  solo en cuanto `B11` exista; no hace falta volver a tocar este repo.
- El `429`/`Retry-After` del interceptor está cubierto con tests unitarios
  (`HttpTestingController`, respuesta simulada) porque el backend tampoco
  tiene límite de peticiones todavía (`B12`, sin hacer) y hoy no puede producir
  un `429` real. Es justo el nivel "unitarias" que pide `PROJECT_SPEC.md` §14
  para este caso.
- **Generador elegido**: `openapi-generator-cli` (`typescript-angular`),
  versión del wrapper npm `2.41.0` y del generador Java `7.25.0` (fijada en
  `openapitools.json`), en vez de `orval`. Genera servicios inyectables sobre
  `HttpClient` sin necesitar `ApiModule`/NgModules (`providedIn=root`).
- **Hueco real encontrado y corregido, no en el generado**: el OpenAPI del
  backend documenta las respuestas con el tipo de contenido comodín (springdoc
  no declara `produces` en `PublicCatalogController`), y el cliente generado
  interpreta eso como "no hay negociación JSON posible" y pide la respuesta
  como blob — reventaba con `NG02807: Response is not a Blob` en cuanto se
  llamaba a cualquier método del servicio generado. Se corrigió con
  `ApiConfiguration` (`core/http/api-configuration.ts`), una subclase de
  `Configuration` que fuerza `selectHeaderAccept` a `application/json`, sin
  tocar `src/app/api/`. Cubierto con un test de regresión que ejercita el
  servicio generado real. El arreglo correcto de fondo es anotar `produces` en
  el backend; queda pendiente ahí, no en este repo.
- **Script de CI**: por ahora es solo el script local (`pnpm api:check`,
  regenera y falla si `src/app/api/` queda desactualizado respecto a lo
  commiteado). El workflow de GitHub Actions que lo ejecutaría de verdad
  (con checkout cruzado de `shop-backend-service`, JDK 25 + Gradle, Postgres)
  queda pendiente: decisión tomada con el usuario, porque ni este repo ni
  `shop-backend-service` tienen todavía ningún pipeline de CI y el backend no
  tiene imagen Docker publicable hasta `B17`.

---

### [x] W2. Estado de navegación en la URL

Servicio `CatalogQueryService` que lee y escribe los parámetros de la URL
(`page`, `size`, `sort`, `q`, `category[]`, `minPrice`, `maxPrice`, `onSale`,
`inStock`) exponiéndolos como signals.

Validación y saneado de los parámetros que llegan de la URL: un `sort`
inventado o un `minPrice` no numérico se ignoran, no rompen la página.

**Aceptación:**
- Casos 19, 20, 21 y 24 de `PROJECT_SPEC.md` §14.
- Una URL con parámetros basura renderiza el catálogo sin filtros, sin errores.
- Funciona en servidor: el SSR lee los parámetros y renderiza filtrado.

**Desviaciones:**
- **`sort=featured` tratado como valor explícito válido, no solo como
  default implícito**: la tabla de `ARQUITECTURA.md` §5.1 solo lista 6
  valores en la columna "Tipo" de `sort` y pone `featured` únicamente en la
  columna "Por defecto". `PROJECT_SPEC.md` §4 confirma un desplegable de 7
  opciones ("Destacados, Nombre A-Z, Nombre Z-A, Precio menor, Precio mayor,
  Más recientes, Relevancia"), así que `CATALOG_SORT_VALUES` en
  `catalog-query.model.ts` incluye `featured` como séptimo valor de la lista
  blanca.
- **Sin prueba de SSR con `renderApplication`/`platform-server`**: todavía no
  existe ninguna página que consuma `CatalogQueryService` (el grid es W3,
  `app.routes.ts` sigue vacío), así que no hay nada real que renderizar en
  servidor para esta tarea. El servicio depende únicamente de `Router`
  (nunca `window`/`document`/`localStorage`/`navigator`), y `Router`/
  `Location` ya están probados como SSR-seguros por el propio `@angular/ssr`
  — no hay ninguna guarda de plataforma que escribir porque no se toca
  ninguna API de navegador. Decisión tomada con el usuario: la prueba real
  con `curl` sobre el HTML ya renderizado (casos 40 y 44 de
  `PROJECT_SPEC.md` §14) queda para W3/W4, que es cuando existe una página
  real. Aquí se prueba con `TestBed` + `RouterTestingHarness` normal.
- **`RouterTestingHarness` necesita `Router.setUpLocationChangeListener()`
  manual**: `RouterTestingHarness.create()` usa `TestBed.createComponent`,
  no `ApplicationRef.bootstrap()`, así que el `APP_BOOTSTRAP_LISTENER` que
  normalmente llama a `router.initialNavigation()` (y que a su vez conecta
  el listener de `popstate`) nunca se ejecuta. Sin esa línea explícita en el
  `beforeEach` del spec, `Location.back()` no le llega nunca al `Router` y
  el test del caso 21 se queda colgado. Documentado como comentario en
  `catalog-query.service.spec.ts`.

---

## Fase 1 — Catálogo

### [ ] W3. Tarjeta de producto y grid

Componente `ProductCard` con imagen (`<picture>` + WebP + `srcset` +
`aspect-ratio` + dimensiones), nombre, precio con descuento, insignia de
porcentaje, indicador de agotado.

Componente `ProductGrid`: 3 columnas en escritorio, 2 en tableta, 1–2 en móvil.
Tarjetas esqueleto para el estado de carga.

`loading="eager"` y `fetchpriority="high"` en las primeras 6 tarjetas; `lazy` en
el resto.

**Aceptación:**
- El grid muestra 3 columnas a 1280 px, 2 a 768 px, 1 a 375 px.
- CLS medido = 0 al cargar las imágenes (verifícalo en Lighthouse).
- Un producto con descuento muestra precio tachado, precio efectivo e insignia.
- Un producto agotado se muestra atenuado con el botón deshabilitado y una
  explicación accesible.
- Un producto sin imagen muestra el respaldo.
- El grid es una lista semántica, no `div`s sueltos.

**Pendiente — no marcar como hecha hasta resolver esto:**
- El criterio de "agotado" pide un botón deshabilitado con explicación
  accesible, pero `ProductCard` todavía no tiene ningún botón (casilla de
  selección y botón de WhatsApp están explícitamente en W9/W10 según el
  propio ROADMAP). Hoy solo se cumple la parte de imagen atenuada + etiqueta
  "Agotado"; falta decidir si este criterio se relaja hasta que el botón
  exista, o si se adelanta un botón deshabilitado mínimo en W3.
- CLS = 0 no está medido con Lighthouse — no hay backend disponible en este
  entorno para servir imágenes reales. Lo verificado es el mecanismo
  (`width`/`height` + `aspect-ratio` en cada `<img>`), no la métrica.

**Desviaciones:**
- **Wiring mínimo de `/` incluido en esta tarea**: `ProductCard`/`ProductGrid`
  son puramente de presentación (reciben todo por `input()`), pero sin una
  página real que los consuma no había forma de medir CLS/columnas con
  Lighthouse sobre HTML de verdad. Se añadió `CatalogPage`
  (`features/catalog/catalog-page/`), que pide la página 0 vía
  `listProducts()` combinando `CatalogQueryService.filters()`/`.page()` con
  `rxResource`, y se registró en `app.routes.ts`. No pagina, no acumula
  lotes, no reintenta ante error — eso es W4. Decisión tomada con el usuario.
- **`@angular/localize` instalado en esta tarea, no en W12**: los textos
  nuevos ("Agotado", "precio anterior", la insignia de descuento, el título
  de la página) llevan `i18n` desde el principio (`ng add @angular/localize`,
  `angular.json` con `i18n.sourceLocale: "es"`, script `extract-i18n`
  verificado). Decisión tomada con el usuario, en vez de dejar cadenas en
  español plano como se había hecho con otras desviaciones. W12 sigue siendo
  responsable de extender esto al resto del sitio y de cualquier
  infraestructura multi-idioma.
- **`src/app/app.routes.server.ts` corregido de `RenderMode.Prerender` a
  `RenderMode.Server`**: con `app.routes.ts` vacío (antes de esta tarea) la
  configuración heredada del scaffold de W0 no tenía ningún efecto real. Al
  añadir la ruta `/`, prerenderizarla en build habría capturado el catálogo
  una sola vez en tiempo de build (sin filtros de URL ni datos en vivo), lo
  que contradice `PROJECT_SPEC.md` §8. No es una desviación de diseño, es
  una corrección necesaria para que la tarea funcione.
- **Limpieza del placeholder del scaffold de Angular CLI** en `app.html`,
  `app.css` y `app.spec.ts` (logo, pills, enlaces a angular.dev): quedaba
  pendiente desde W0 y bloqueaba ver el grid real en `/`.
- **Imagen de respaldo no documentada en `ARQUITECTURA.md`**: no hay ninguna
  convención de "producto sin imagen" en el contrato de API. Se añadió
  `public/images/product-placeholder.svg` (SVG propio, neutro) como
  decisión de frontend, dentro de lo que `PROJECT_SPEC.md` §5 ya pide
  explícitamente ("Imagen de respaldo si el producto no tiene ninguna").
- **CSS propio, sin Tailwind**: no estaba instalado; añadirlo como
  dependencia nueva solo para esta tarea no se justificaba. Se creó el
  primer set de variables de diseño en `src/styles.css` (antes vacío).
- **Verificado sin backend disponible en este entorno**: con
  `API_BASE_URL` inalcanzable, `GET /` sigue devolviendo `200` con el estado
  de carga (tarjetas esqueleto) renderizado en servidor, sin reventar —
  confirmado con `curl` sobre el HTML real. La verificación completa con
  datos reales (columnas en 375/768/1280 px, CLS con Lighthouse, que el
  primer lote no se pida dos veces) queda pendiente de hacer con el backend
  de `tienda-backend` levantado, tal como pide el criterio de aceptación.

---

### [ ] W4. Scroll infinito

`IntersectionObserver` sobre un centinela. Indicador de carga con tarjetas
esqueleto. Una sola petición en vuelo. Fin de lista explícito. Botón
"Reintentar" ante error. Botón "Cargar más" accesible como respaldo.

Solo se activa tras la hidratación (no existe en servidor).

**Aceptación:**
- Casos 13 a 18 de `PROJECT_SPEC.md` §14, todos con test.
- El caso 15 (no duplicar peticiones al bajar rápido) tiene test.
- Navegando solo con teclado se puede cargar el siguiente lote.
- Los nuevos lotes se anuncian con `aria-live`.
- Caso 40: `GET /` devuelve HTML con el primer lote ya renderizado. Compruébalo
  sobre el cuerpo de la respuesta (`curl`), no sobre el DOM ya hidratado.
- Caso 44: el primer lote **no se pide dos veces** (una en servidor y otra al
  hidratar). Verifícalo en la pestaña de red; si se duplica, falta la
  transferencia de estado.

**Pendiente — no marcar como hecha hasta resolver esto:**
- **Casos 40 y 44 no verificados de verdad**: no hay backend disponible en
  este entorno (igual que en W3), y además `pnpm build` + servir el bundle
  SSR (`node dist/shop-dashboard-web/server/server.mjs`) rechaza con `400`
  cualquier petición cuyo header `Host` no esté en la lista blanca SSRF que
  trae Angular 22 por defecto — ni `localhost:4000` ni `127.0.0.1:4000`
  pasan sin configurar `serverRoutes`/el host permitido. No se tocó esa
  configuración porque es un tema de despliegue ortogonal a esta tarea, no
  algo que W4 deba decidir por su cuenta. Lo verificado: `pnpm build`
  produce el bundle de servidor sin errores, y el cliente generado ya manda
  `transferCache: true` por defecto en `listProducts()` (mecanismo que da la
  deduplicación de la transferencia de estado). Falta la comprobación real
  con `curl`/pestaña de red contra un backend y un host permitidos.

**Desviaciones:**
- **La profundidad de scroll no vive en la URL** (decisión tomada con el
  usuario): `page`/`setPage()` de `CatalogQueryService` (W2) quedan sin usar
  en el flujo de scroll infinito — no se tocaron ni se borraron, siguen
  siendo válidos por si hiciera falta paginación clásica más adelante. Cada
  carga/recarga arranca siempre en la página 0, en línea literal con
  `PROJECT_SPEC.md` §3 ("El servidor renderiza solo el primer lote").
- **`requestedPage` y `accumulatedProducts` son `linkedSignal`, no
  `signal` + `effect()`**: la primera implementación reseteaba ambos desde
  un `effect()` separado que reaccionaba a `catalogQuery.filters()`. Eso
  crea una carrera real: el `computed` de los parámetros de la petición
  (que también depende de `filters()`) se recalcula en el mismo ciclo *antes*
  de que el efecto de reseteo llegue a escribir la página de vuelta a 0,
  así que se disparaba una petición fantasma con los filtros nuevos y la
  página vieja. Cubierto por el caso 18 del spec, que lo detectó en rojo
  antes del cambio a `linkedSignal` (que reinicia de forma síncrona, dentro
  del mismo recálculo reactivo).
- **Toda lectura de `pageResource.value()` pasa primero por `.status() === 'resolved'`**:
  el `resource()`/`rxResource()` de Angular 22 lanza al leer `.value()`
  mientras el estado es `'error'` (no devuelve el último valor bueno en
  silencio, como cabría esperar). Sin este chequeo, un lote fallido tumbaba
  el render en vez de mostrar "Reintentar". `.status()` y `.error()` sí son
  seguros de leer siempre.
- **`IntersectionObserver` no existe en `jsdom`** (el entorno de
  `pnpm test`): se añadió `src/test-setup.ts` (registrado en
  `angular.json` → `test.options.setupFiles`) con un stub mínimo sin
  comportamiento, para que cualquier componente que use
  `shared/intersection-observer/` no reviente el render en tests que no
  necesitan simular una intersección real. `intersect-on-visible.spec.ts`
  instala su propio fake más completo (captura el callback) y lo restaura
  después.
- **El `aria-live` no anunciaba los lotes que sí se cargaban bien**: la
  primera versión de `CatalogLoadMore` solo tenía texto para
  cargando/error/fin de lista — un lote que se sumaba con éxito (quedando
  `hasNext: true`) no cambiaba el contenido de la región, así que no se
  anunciaba nada. Se añadió un input `count` (el total de productos que
  `CatalogPage` tiene acumulados) y un texto por defecto ("Mostrando N
  productos.") que cambia con cada lote nuevo — es ese cambio de contenido
  lo que dispara el anuncio. Detectado en esta revisión, no en la
  implementación original; cubierto ahora por un test en
  `catalog-load-more.spec.ts`.
- **Caso 14 (indicador visible mientras carga) no tenía test propio**: los
  tests originales resolvían la petición con `of(...)` de forma síncrona,
  así que nunca se observaba el estado "cargando" de verdad. Se añadió un
  test en `catalog-page.spec.ts` que usa un `Subject` para dejar la
  petición de la página 1 pendiente a propósito, comprobar que aparecen las
  tarjetas esqueleto y el anuncio de carga, y solo entonces resolverla.
- **Verificación real de "operable con teclado"**: además del test de
  componente (que solo simula `click`), se comprobó con Playwright contra
  `pnpm start` (sin backend) que `Tab` llega al botón "Cargar más"/"Reintentar"
  y que `Enter` lo activa (se confirmó una segunda petición a
  `/api/public/v1/products` tras pulsar Enter, sin haber hecho clic nunca).
  Script ad-hoc, no incorporado al repo — la cobertura formal de flujos de
  teclado en un navegador real es de Playwright/W14.

---

### [ ] W5. Filtros, búsqueda y ordenamiento

Panel de filtros: categorías con conteos, rango de precio, interruptor de
ofertas, orden, búsqueda con debounce de 300 ms, "Limpiar filtros" con contador.
En móvil, panel lateral con insignia de filtros activos (cargado bajo demanda).

Estado vacío con mensaje y botón de limpiar.

**Aceptación:**
- Casos 19 a 25 de `PROJECT_SPEC.md` §14, todos con test.
- El caso 22 comprueba que 5 pulsaciones rápidas producen 1 petición.
- El caso 23 valida mínimo ≤ máximo antes de consultar.
- Cambiar cualquier filtro reinicia la lista y sube el scroll.
- El panel móvil es operable con teclado y atrapa el foco.

---

## Fase 2 — Detalle

### [ ] W6. Página de detalle con SSR

Ruta `/p/:slug` renderizada en servidor. Carrusel de imágenes `detail` con
flechas, puntos, miniaturas en escritorio y deslizamiento táctil en móvil.
Nombre, SKU, precio, disponibilidad, descripción saneada, instrucciones de uso
condicionales, selector de cantidad.

Un slug inexistente o de un producto no publicado devuelve **404 real**.

**Aceptación:**
- Casos 37, 38, 41, 42 y 43 de `PROJECT_SPEC.md` §14.
- El caso 42 se comprueba con el código de estado HTTP de la respuesta, no con
  lo que se ve en pantalla.
- Sin instrucciones de uso, esa sección no se renderiza en absoluto.
- El carrusel se navega con las flechas del teclado y anuncia "imagen N de M".
- `DomSanitizer` con lista blanca sobre la descripción; nunca
  `bypassSecurityTrustHtml`.

---

### [ ] W7. Modal de detalle sobre el grid

El mismo contenido de W6 dentro de un modal poco intrusivo, que **cambia la URL
a `/p/:slug`** sin recargar. Cargado bajo demanda.

Accesibilidad completa según `PROJECT_SPEC.md` §6: foco atrapado, `Escape`
cierra, foco devuelto a la tarjeta de origen, `role="dialog"`,
`aria-modal="true"`, fondo con `inert`, sin scroll del fondo, scroll preservado
al cerrar.

**Aceptación:**
- Casos 32 a 36 y 39 de `PROJECT_SPEC.md` §14, todos con test.
- El caso 33 (atrás cierra y preserva la posición de scroll) tiene test de
  extremo a extremo.
- El caso 36 (foco devuelto a la tarjeta exacta) tiene test.
- Abrir el modal y recargar la página muestra la vista completa de W6.
- Axe sin infracciones con el modal abierto.

---

## Fase 3 — WhatsApp

### [ ] W8. Renderizado de plantillas

`WhatsAppTemplateService`: implementa exactamente las reglas de
`ARQUITECTURA.md` §6 — los 9 marcadores por producto, los 5 globales, marcador
desconocido literal, marcador de producto en plantilla global vacío, formato de
moneda con `Intl.NumberFormat`, URL absoluta, truncado a 1500 caracteres,
codificación correcta.

**Esta es la pieza más importante del repositorio. Cobertura 100 %.**

**Aceptación:**
- Casos 1 a 12 de `PROJECT_SPEC.md` §14, todos con test.
- El caso 11 prueba con `&`, `#`, `+`, tildes, emojis y saltos de línea.
- El caso 12 recorre el archivo `whatsapp-golden.json` que publica el backend y
  comprueba que la salida coincide caso por caso. Si difiere, una de las dos
  implementaciones está mal. Este repo **no** llama a `/api/admin/**`.
- Cobertura del servicio: 100 % de líneas y ramas.

---

### [ ] W9. Selección múltiple y barra de acción

`SelectionService` con signals, persistido en `sessionStorage` guardando **solo
`{ productId, cantidad }`**. Al restaurar, refresca los datos desde la API y
descarta los productos ya no publicados. Tope `catalog.max_selection`.

Barra fija inferior con conteo, total y botones "Ver" y "Enviar por WhatsApp".
Panel de selección para ajustar cantidades y quitar productos.

Funciona en servidor devolviendo selección vacía.

**Aceptación:**
- Casos 26 a 31 de `PROJECT_SPEC.md` §14, todos con test.
- El caso 29 es crítico: los precios se refrescan, no se leen de `sessionStorage`.
- El caso 30: un producto despublicado desaparece al restaurar.
- El SSR no revienta al no existir `sessionStorage`.
- La barra es operable con teclado y se anuncia al aparecer.

---

### [ ] W10. Vista previa y redirección

Diálogo de vista previa con el mensaje renderizado, botón "Enviar" y botón
"Copiar". Envío del evento `WHATSAPP_CLICK` con `sendBeacon` o `keepalive`
**sin esperar respuesta**. Apertura con
`window.open(url, '_blank', 'noopener,noreferrer')`.

Botón de WhatsApp individual en la tarjeta y en el modal.

**Aceptación:**
- La URL generada es `https://wa.me/{numero}?text={mensaje}` correctamente
  codificada; test que la verifica interceptando `window.open`.
- Un fallo del evento de analítica **no** impide la redirección; test explícito.
- "Copiar" copia el texto sin codificar.
- El diálogo cumple las mismas reglas de accesibilidad del modal.

---

## Fase 4 — SEO, i18n y pulido

### [ ] W11. SEO completo

Meta tags dinámicos por página (título, descripción, Open Graph con imagen
absoluta, canonical, Twitter Card). JSON-LD: `Product` + `Offer` en el detalle,
`ItemList` y `BreadcrumbList` en el catálogo, `Organization` en el layout.
`/sitemap.xml` generado en servidor y cacheado 1 hora. `/robots.txt`.

**Aceptación:**
- Caso 45 y 46 de `PROJECT_SPEC.md` §14.
- El JSON-LD pasa la herramienta de pruebas de resultados enriquecidos de Google
  **sin errores ni advertencias**. Verifícalo de verdad.
- `og:image` es una URL absoluta a la versión `detail`.
- El canonical de `/` no incluye parámetros de filtro.
- Lighthouse SEO = 100.

---

### [ ] W12. Internacionalización

Externalizar **todos** los textos con `@angular/localize`. Pipes localizados
para fechas, números y moneda. `<html lang="es">`.

**Aceptación:**
- Una búsqueda de cadenas literales en plantillas y componentes no encuentra
  ningún texto de interfaz.
- `pnpm extract-i18n` produce el archivo de mensajes completo.
- Ningún precio, fecha o número formateado a mano.

---

### [ ] W13. Rendimiento y accesibilidad

Auditoría y corrección hasta cumplir los objetivos de `PROJECT_SPEC.md` §10 y
§11. Carga diferida de rutas y componentes pesados. Presupuestos de tamaño
configurados en `angular.json` que **rompen el build** al excederse.

**Aceptación:**
- Lighthouse en `/` y `/p/:slug` (móvil, 4G simulada): Rendimiento ≥ 90,
  Accesibilidad ≥ 95, SEO 100, Buenas prácticas ≥ 95.
- LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- JS inicial < 200 KB comprimido, con el presupuesto configurado.
- Caso 50 de §14: Axe sin infracciones críticas ni serias en las tres vistas.
- Caso 48: el flujo completo es operable solo con teclado.
- `prefers-reduced-motion` respetado.

---

### [ ] W14. Extremo a extremo y despliegue

Suite de Playwright con los casos 47 a 50. `Dockerfile` multi-etapa para el
servidor SSR, usuario no root, `HEALTHCHECK`. README con instrucciones reales.

**Aceptación:**
- `pnpm e2e` pasa contra el backend en Docker.
- Los tres flujos (escritorio, teclado, móvil 375 px) pasan.
- La imagen construye y sirve el sitio con SSR.
- La IP del contenedor SSR está documentada como la que hay que añadir a
  `INTERNAL_CLIENTS` del backend — sin eso el sitio se auto-bloquea.
- Seguir el README desde cero levanta el sitio.

---

## Cuando todo esté marcado

Repasa `PROJECT_SPEC.md` §15 uno por uno. La prueba final es real: despliega,
pega un enlace `/p/:slug` en una conversación de WhatsApp y comprueba que sale
la foto y el título del producto.
