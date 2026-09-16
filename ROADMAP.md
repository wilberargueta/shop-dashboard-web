# ROADMAP — shop-dashboard-web

Tareas en orden. **Este repo depende del backend**: no empieces hasta que las
tareas B0–B4 de `shop-backend-service` estén terminadas y el OpenAPI sea generable.

Marca `[x]` al completar y anota desviaciones.

---

## Anclas responsive — respétalas desde el principio

El grueso del trabajo responsive es **W13**, y está ahí a propósito: casi todo
es CSS y se puede ajustar después sin tocar la estructura.

Pero **estas cuatro decisiones no son CSS**, y aplicarlas tarde significa
reescribir. Respétalas en las tareas donde aparecen, aunque el diseño móvil
todavía no esté pulido:

| Ancla | Dónde se decide | Qué pasa si se ignora |
|---|---|---|
| El contenido del detalle vive en un **componente propio**, y la página, el modal y la hoja móvil solo son contenedores distintos que lo envuelven | W6 y W7 | Si el modal lleva el contenido dentro, la variante móvil obliga a duplicarlo o a reescribirlo |
| Toda imagen con `srcset` declara `sizes`, y el `srcset` incluye `card` y `card2x` con sus descriptores `w` | W3 | Sin `sizes` el navegador asume ancho completo de ventana y descarga la imagen equivocada en el grid. Es un bug de rendimiento, no un detalle estético |
| El contenedor del grid reserva espacio inferior cuando la barra de selección está visible | W9 | La barra tapa los últimos productos y no se pueden pulsar |
| Los puntos de corte se declaran como variables CSS una sola vez, con la escala de `docs/ARQUITECTURA.md` §8 | W0 | Acabas con anchos mágicos repartidos por veinte archivos |

Las dos primeras son las caras. Las otras dos son baratas de arreglar después,
pero cuestan un minuto ahora.

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
  existe en el backend — es la tarea `B11` de `shop-backend-service`, que va después
  de identidad/admin/imágenes y no está hecha (verificado contra el backend
  real corriendo en `localhost:8080`, commit `d2ffbcc`, con `B0`-`B4` aplicados).
  Por `CLAUDE.md` ("Falta un campo en la API → dilo; el cambio es en el
  backend"), no se ha inventado el tipo a mano. `pnpm api:generate` lo traerá
  solo en cuanto `B11` exista; no hace falta volver a tocar este repo.
- El `429`/`Retry-After` del interceptor está cubierto con tests unitarios
  (`HttpTestingController`, respuesta simulada) porque el backend tampoco
  tiene límite de peticiones todavía (`B12`, sin hacer) y hoy no puede producir
  un `429` real. Es justo el nivel "unitarias" que pide `PROJECT_SPEC.md` §15
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
- Casos 19, 20, 21 y 24 de `PROJECT_SPEC.md` §15.
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
  `PROJECT_SPEC.md` §15) queda para W3/W4, que es cuando existe una página
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
- **Ancla responsive**: el `srcset` incluye `card` (600w) con su descriptor
  `w`, y hay un `sizes` que describe el ancho real de la tarjeta en cada
  punto de corte. Sin `sizes`, el navegador asume el ancho completo de la
  ventana y descarga la imagen equivocada. Ver el ejemplo de `<picture>` en
  `PROJECT_SPEC.md` §5. El candidato `card2x` (1200w) queda fuera — ver
  `W3.1`.
- CLS medido = 0 al cargar las imágenes (verifícalo en Lighthouse).
- Un producto con descuento muestra precio tachado, precio efectivo e insignia.
- Un producto agotado se muestra atenuado con el botón deshabilitado y una
  explicación accesible.
- Un producto sin imagen muestra el respaldo.
- El grid es una lista semántica, no `div`s sueltos.

**Desviaciones:**
- **Botón deshabilitado mínimo del criterio de "agotado", adelantado en esta
  tarea** (decisión tomada con el usuario): `ProductCard` todavía no tiene el
  botón real de WhatsApp — eso sigue siendo W10 — pero un producto agotado
  ahora renderiza un `<button>` con `aria-disabled="true"` (nunca el atributo
  `disabled`: lo dejaría fuera del orden de tabulación y algún lector de
  pantalla no anunciaría la explicación) y `aria-describedby` apuntando a un
  texto accesible ("Agotado. No disponible para pedido por ahora."). Solo se
  renderiza para productos agotados; para productos disponibles no hay
  ningún botón todavía. W10 generalizará esto: el botón se renderizará
  siempre, con `aria-disabled` condicional a `inStock` y el manejador de
  clic real con retorno temprano si está agotado. Convención anotada en
  `CLAUDE.md` §Accesibilidad para que el resto del repo la siga igual.
- **Corregida una contradicción real en `PROJECT_SPEC.md`** (decisión tomada
  con el usuario): §3 decía que la tableta pasa a 2 columnas a partir de
  640 px, pero §5 (el propio ejemplo de `sizes` que este ancla pide seguir)
  y §11 decían 768 px — y el código ya tenía 640 px, sin corresponder a
  ninguno de los dos. Se corrigió `PROJECT_SPEC.md` §3 a 768 px (coincide con
  `md` de la escala de `ARQUITECTURA.md` §8 y con lo que ya dice §11) y se
  movió `product-grid.css` de 640 px a 768 px para que el `sizes` añadido
  ahora sea honesto con lo que el grid realmente renderiza. Para mitigar que
  las tarjetas de una sola columna entre 480–767 px queden demasiado anchas,
  `.product-grid` lleva un `max-width` centrado en ese rango, que se retira
  desde 768 px. No se introdujo el sistema de variables CSS de breakpoints
  de `ARQUITECTURA.md` §8 — ese refactor es un criterio de aceptación propio
  de `W13`, hacerlo aquí solo para `product-grid.css` habría duplicado
  trabajo.
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
  de `shop-backend-service` levantado, tal como pide el criterio de aceptación.

**Pendiente — CLS sigue sin medirse, no marcar `[x]` hasta resolver esto:**
- Se añadió `pnpm lighthouse` (antes solo documentado en `CLAUDE.md`, nunca
  implementado) y se confirmó `pnpm lint && pnpm test && pnpm build` en
  verde (76 tests, sin errores de lint, bundle inicial 94.43 kB transferido —
  dentro del presupuesto de 200 KB). Pero al intentar medir CLS de verdad,
  `localhost:8080` no respondió (`Connection refused`, confirmado también
  sin el aislamiento de red del entorno de ejecución, no es un problema de
  sandbox): el backend real no estaba arriba en este entorno pese a lo
  indicado. No se inventó un número de CLS. Falta repetir `pnpm build` →
  `pnpm serve:ssr:shop-dashboard-web` → `pnpm lighthouse` con el backend de
  verdad accesible, leer el CLS de `lighthouse-report.html`, y solo entonces
  marcar esta tarea `[x]` (o documentar la causa si el número no es bueno).

---

### [ ] W3.1. `srcset` con `card2x` (pendiente del backend)

`ImageRef` (`src/app/api/model/image-ref.ts`) solo expone hoy `thumb` y
`card` — `card2x` no existe en el cliente generado porque el backend
todavía no lo produce (`B9`/`B10` de `shop-backend-service`). W3 aplicó el
ancla de `sizes` con el único candidato disponible (`card`, 600w).

**Aceptación:**
- Tras `B9`/`B10` y `pnpm api:generate`, `ImageRef.card2x` existe con su
  `RenditionRef`.
- `ProductCard` añade el candidato `card2x` (1200w) al mismo `srcset` que ya
  tiene `card` (600w), en `<source>` e `<img>`, sin tocar `sizes` (ya
  correcto desde W3).
- Test actualizado en `product-card.spec.ts` verificando ambos candidatos en
  el `srcset`.

---

### [x] W4. Scroll infinito

`IntersectionObserver` sobre un centinela. Indicador de carga con tarjetas
esqueleto. Una sola petición en vuelo. Fin de lista explícito. Botón
"Reintentar" ante error. Botón "Cargar más" accesible como respaldo.

Solo se activa tras la hidratación (no existe en servidor).

**Aceptación:**
- Casos 13 a 18 de `PROJECT_SPEC.md` §15, todos con test.
- El caso 15 (no duplicar peticiones al bajar rápido) tiene test.
- Navegando solo con teclado se puede cargar el siguiente lote.
- Los nuevos lotes se anuncian con `aria-live`.
- Caso 40: `GET /` devuelve HTML con el primer lote ya renderizado. Compruébalo
  sobre el cuerpo de la respuesta (`curl`), no sobre el DOM ya hidratado.
  **Verificado** contra el backend real (`shop-backend-service`,
  `localhost:8080`): el HTML crudo de `curl http://localhost:4200/` trae el
  nombre, precio e imagen del producto de prueba, sin tarjetas esqueleto.
- ~~Caso 44: el primer lote **no se pide dos veces**~~ — **no se cumple, y se
  traslada a `W13`** (decisión tomada con el usuario: es un problema de
  infraestructura SSR/caché HTTP, no encaja temáticamente en ninguna tarea
  de catálogo). Detalle completo, causa raíz y las opciones para resolverlo
  están en la sección "Pendiente" de `W13`.

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
- **Bug real encontrado con el backend real, no en W4 pero en el mismo
  archivo**: `CatalogPage` mandaba `sort=featured` explícito por defecto
  (`DEFAULT_CATALOG_SORT` de W2). El backend lo rechaza con `400` ("valor no
  permitido: featured") — `ARQUITECTURA.md` §5.1 solo documenta `featured`
  en la columna "Por defecto", nunca como valor aceptado en la lista blanca.
  Sin esto, **toda carga inicial sin un `sort` explícito en la URL fallaba**
  contra el backend real (no se detectó antes porque hasta ahora todos los
  tests mockeaban `listProducts`). Corregido: `requestParams` omite `sort`
  cuando es el valor por defecto. Cubierto con dos tests nuevos en
  `catalog-page.spec.ts`.
- **`proxy.conf.json` añadido** (referenciado desde `angular.json` →
  `serve.options.proxyConfig`): sin él, `pnpm start` no tiene forma de
  resolver las peticiones relativas del navegador a `/api/**` y `/media/**`
  contra el backend — necesario para poder ver la página funcionando de
  verdad en desarrollo, no específico de W4.

---

### [x] W5. Filtros, búsqueda y ordenamiento

Panel de filtros: categorías con conteos, rango de precio, interruptor de
ofertas, orden, búsqueda con debounce de 300 ms, "Limpiar filtros" con contador.
En móvil, panel lateral con insignia de filtros activos (cargado bajo demanda).

Estado vacío con mensaje y botón de limpiar.

**Aceptación:**
- Casos 19 a 25 de `PROJECT_SPEC.md` §15, todos con test.
- El caso 22 comprueba que 5 pulsaciones rápidas producen 1 petición.
- El caso 23 valida mínimo ≤ máximo antes de consultar.
- Cambiar cualquier filtro reinicia la lista y sube el scroll.
- El panel móvil es operable con teclado y atrapa el foco.

**Desviaciones:**
- **Casos 19, 20, 21 y 24 no se volvieron a probar a nivel de routing**: ya
  estaban en verde desde W2 (`catalog-query.service.spec.ts`, contra
  `CatalogQueryService` real con `RouterTestingHarness`). Aquí solo se
  añadieron los tests de UI que conectan controles reales (casillas, campo
  de búsqueda, `<select>`) a ese servicio ya probado — no tenía sentido
  repetir la mecánica de navegación/historial.
- **`CatalogFilterPanel` (los controles) es puramente presentacional**,
  separado de `CatalogFilterMobilePanel` (el envoltorio con disparador,
  insignia, fondo y `appFocusTrap`) — decisión tomada con el usuario. No
  inyecta `CatalogQueryService` ni el cliente de API: recibe `filters`/
  `categories` por `input()`, emite `filtersChange`/`clear`, igual que
  `ProductGrid`/`CatalogLoadMore`. Se monta dos veces en el DOM (columna
  fija de escritorio + dentro del panel móvil diferido, una de las dos
  siempre oculta por CSS, no eliminada), así que sus `id` internos
  (`aria-describedby` del error de precio) llevan un prefijo de instancia
  para no chocar.
- **Primera directiva de foco atrapado del repo**: `appFocusTrap`
  (`shared/focus-trap/`) no existía ningún patrón previo que reutilizar.
  Mínima a propósito — solo cicla `Tab`/`Shift+Tab` dentro del host, enfoca
  el primer elemento al activarse y devuelve el foco a `returnFocusTo` al
  destruirse. No maneja `Escape` (decisión de cada host) ni pone `inert`
  en el fondo (ese nivel de aislamiento de modal completo es explícito de
  W7 para el detalle de producto, no lo pide el criterio de W5). Queda
  lista para que W7 la reutilice en el modal de detalle.
- **División responsive en dos, no tres**: `PROJECT_SPEC.md` §11 describe
  tres tratamientos (hoja inferior en móvil, panel lateral en tableta,
  columna fija en escritorio), pero el propio `W13` lo simplifica a dos
  ("panel deslizante en móvil y columna lateral en escritorio"). Se
  construyó ese binario: panel superpuesto con disparador+insignia por
  debajo de 1024px, columna lateral fija desde 1024px. La distinción fina
  "desde abajo" vs. "desde el lateral" entre móvil y tableta es CSS puro y
  queda para el repaso de `W13`. Decisión tomada con el usuario.
- **`@defer (on interaction(trigger))` en el panel móvil**: el JS del
  diálogo (fondo, `appFocusTrap`, `CatalogFilterPanel` anidado) se separa
  en un chunk aparte que solo se descarga si alguien lo abre — confirmado
  en `pnpm build`, aparece como chunk perezoso independiente del bundle
  inicial. El bundle inicial quedó en 104.39 kB transferidos, dentro del
  presupuesto de 200 KB.
- **Hallazgo real de pruebas**: simular el disparador `on interaction` con
  un `fireEvent.click` sintético en jsdom no dispara el `@defer` de forma
  fiable (el bloque nunca pasa a su estado "Complete"). Se usó la API
  pública de Angular para tests, `deferBlockStates: DeferBlockState.Complete`
  al llamar `render()`, que fuerza el contenido diferido a su estado final
  sin depender del disparador — lo que se prueba en
  `catalog-filter-mobile-panel.spec.ts` es el diálogo (foco, `Escape`,
  fondo), no el mecanismo de `@defer` en sí.
- **"Relevancia" solo aparece en el `<select>` de orden cuando hay una
  búsqueda activa** (`filters().q` no vacío) — lectura directa de
  "(solo con búsqueda activa)" en `PROJECT_SPEC.md` §4.
- **El contador de "Limpiar filtros" no cuenta `sort`**: cuenta categorías,
  precio mínimo/máximo, búsqueda y ofertas (`countActiveFilters()` en
  `catalog-query.util.ts`). `sort` es orden, no filtro; al pulsar "Limpiar"
  igual se resetea todo (ya es lo que hacía `clearFilters()` desde W2).
- **Rango de precio con dos `<input type="number">`**, no un control
  deslizante doble — `PROJECT_SPEC.md` §4 permite explícitamente cualquiera
  de los dos. Se valida en cada tecla (mensaje de error visible +
  `aria-invalid`/`aria-describedby`), pero solo se emite el cambio en
  `(change)` (perder el foco o `Enter`), nunca por tecla — evita disparar
  una consulta por cada dígito sin necesitar debounce.
- **Verificado sin backend disponible en este entorno**: `pnpm lint && pnpm
  test && pnpm build` en verde (100 tests), pero la verificación manual
  completa (URL real sobreviviendo a un recargado, `Tab`/`Escape` en el
  panel con datos reales, estado vacío con un filtro imposible de verdad)
  queda pendiente de hacer con el backend de `shop-backend-service`
  levantado — mismo motivo que en W3.

---

## Fase 2 — Detalle

### [x] W6. Página de detalle con SSR

Ruta `/p/:slug` renderizada en servidor. Carrusel de imágenes `detail` con
flechas, puntos, miniaturas en escritorio y deslizamiento táctil en móvil.
Nombre, SKU, precio, disponibilidad, descripción saneada, instrucciones de uso
condicionales, selector de cantidad.

Un slug inexistente o de un producto no publicado devuelve **404 real**.

**Aceptación:**
- Casos 37, 38, 41, 42 y 43 de `PROJECT_SPEC.md` §15.
- El caso 42 se comprueba con el código de estado HTTP de la respuesta, no con
  lo que se ve en pantalla.
- Sin instrucciones de uso, esa sección no se renderiza en absoluto.
- El carrusel se navega con las flechas del teclado y anuncia "imagen N de M".
- `DomSanitizer` con lista blanca sobre la descripción; nunca
  `bypassSecurityTrustHtml`.
- **Ancla responsive**: todo el contenido del detalle vive en un componente
  propio (`ProductDetailContent`) que no sabe nada del contenedor que lo
  envuelve. La página lo usa dentro del layout; W7 lo usará dentro de un modal;
  W13 lo usará dentro de una hoja a pantalla completa. Si el contenido queda
  acoplado al contenedor, esas dos tareas se vuelven una reescritura.

**Desviaciones:**
- **404 real vía `RESPONSE_INIT`, no vía `DomSanitizer` explícito para la
  descripción**: `RESPONSE_INIT` (`InjectionToken<ResponseInit | null>`) vive
  en `@angular/core`, no en `@angular/ssr` como en versiones anteriores de
  Angular — verificado leyendo `node_modules/@angular/core/types/core.d.ts`
  antes de usarlo. Es un objeto mutable, presente solo en servidor; mutar
  `.status = 404` en un `effect()` cuando `getProduct()` falla con
  `ApiError.status === 404` hace que el servidor real devuelva 404 (casos 42
  y 43 — el backend no distingue slug inexistente de producto en borrador,
  así que tampoco lo intenta el frontend). Sobre la descripción: no se
  inyectó `DomSanitizer` a mano — un binding a `[innerHTML]` ya pasa por el
  saneador interno de Angular (lista blanca de etiquetas/atributos) salvo que
  se llame `bypassSecurityTrustHtml`, que es justo lo que prohíben
  `PROJECT_SPEC.md` §6 y `CLAUDE.md`. Escribir un saneador propio habría sido
  código nuevo que mantener sin necesidad. Cubierto con un test que inyecta
  un `<script>` en la descripción y confirma que no aparece en el DOM ni se
  ejecuta.
- **Hallazgo real de `resource()`/`rxResource()`**: cualquier error que no
  "parezca" un `Error` (sin `.name`/`.message` string, que es justo la forma
  de `ApiError`) se envuelve en un `ResourceWrappedError`, guardando el valor
  original en `.cause` (`encapsulateResourceError`, interno de
  `@angular/core`). Leer `productResource.error()` directamente y comparar
  `.status` fallaba en silencio (los casos 42/43 caían siempre en el mensaje
  de error genérico) hasta desenvolver `.cause`. Cubierto por los tests de
  `product-detail-page.spec.ts` que sí distinguen 404 de un 500 genérico.
- **`i18n-aria-label`/`i18n-aria-roledescription` con interpolación no
  renderiza el atributo**: en `aria-label="Ir a la imagen {{ i + 1 }}"`
  combinado con `i18n-aria-label`, el atributo desaparecía por completo del
  DOM (confirmado con la salida de `@testing-library/angular` en rojo, sin
  ningún `aria-label` en el HTML compilado) — la misma combinación con texto
  **estático** (sin interpolar) sí funciona. Se cambió al patrón ya
  establecido en el repo (`ProductCard`, `CatalogLoadMore`): un
  `<span class="visually-hidden" i18n="@@clave">` con interpolación dentro
  del botón/elemento, referenciado con `aria-labelledby` cuando hace falta,
  en vez de un `aria-label` dinámico. Ese patrón sí está probado y en uso.
- **`SITE_URL` (`core/config/site-url.token.ts`), infraestructura nueva
  reutilizable**: los `renditions` de imagen que devuelve la API son rutas
  relativas (`/media/...`, `ARQUITECTURA.md` §5.1), pero `og:image`/`og:url`
  necesitan ser absolutas. A diferencia de `API_BASE_URL` (relativa en
  navegador, absoluta en servidor — `PROJECT_SPEC.md` §8), `SITE_URL` es el
  mismo valor absoluto en los dos lados, porque alimenta una metaetiqueta que
  viaja tal cual en el HTML servido al navegador. W8 (`{{url}}` de WhatsApp)
  y W11 (canonical) reutilizarán este mismo token.
- **`withComponentInputBinding()` activado en `provideRouter`**
  (`app.config.ts`): primer parámetro de *ruta* del repo (`CatalogQueryService`
  solo leía parámetros de *query*). `ProductDetailPage.slug` se rellena solo
  desde `:slug`, sin inyectar `ActivatedRoute` a mano. No afecta a
  `CatalogPage`, que no declara `input()`.
- **Meta tags mínimos adelantados de W11, solo lo que pide el caso 41**:
  título, descripción y Open Graph (`og:title`, `og:description`, `og:image`
  absoluta, `og:url`, `og:type`). W11 sigue siendo dueño de JSON-LD,
  canonical con la lógica de filtros, Twitter Card y sitemap/robots. Sin
  `settings.seo.default_og_image_id` disponible todavía (bloqueado por `B11`
  del backend, misma desviación documentada en W1), un producto sin imágenes
  simplemente no publica `og:image` en vez de inventar un respaldo; `store.name`
  tampoco está disponible por el mismo bloqueo, así que `og:site_name` no se
  rellena con un valor real.
- **`ProductPrice` extraído de `ProductCard` a `shared/product-price/`**: el
  bloque de precio con descuento (`<s>` + "precio anterior" oculto + insignia
  "-N%") era idéntico en los dos sitios que ahora lo necesitan. Se extrajo a
  un componente compartido en vez de duplicar marcado sensible a
  accesibilidad que podría divergir con el tiempo; `ProductCard` pasa a
  usarlo. Las claves i18n se renombraron de `productCard.*` a
  `productPrice.*` — no hay traducciones reales todavía, así que no rompe
  nada, y los tests de `ProductCard` siguen en verde porque comprueban
  texto/rol visible, no el id de i18n.
- **`QuantityStepper` (`shared/quantity-stepper/`) y
  `ProductDetailSkeleton` (`shared/product-detail-skeleton/`) nuevos,
  pensados para reutilizarse**: el selector de cantidad no tiene tope real de
  stock que aplicar — la API pública solo expone `inStock: boolean`, nunca un
  conteo (`ARQUITECTURA.md` §4.6, el stock exacto es solo de backoffice), así
  que min=1 sin máximo es la decisión correcta, no un hueco. W9 reutilizará
  `QuantityStepper` en el panel de selección.
- **Ruta comodín `**` → 404 genérico, fuera de alcance** (decisión tomada con
  el usuario): `PROJECT_SPEC.md` §2 menciona `/404` como pantalla, pero
  ningún ítem del ROADMAP la asigna explícitamente. W6 resuelve solo el 404
  de producto (misma ruta `/p/:slug`, sin cambiar de URL). Queda como hueco
  documentado, no como parte de esta tarea.
- **Verificado con `shop-backend-service` real levantado** (sesión posterior a
  la primera implementación): con el único producto publicado de los datos
  semilla (`aceite-esencial-de-lavanda-30ml`), `curl -i` sobre
  `http://localhost:4200/p/aceite-esencial-de-lavanda-30ml` (con `pnpm start`
  apuntando al backend real) trae en el HTML crudo
  `<title>Aceite esencial de lavanda 30ml</title>`,
  `<meta property="og:image" content="http://localhost:4200/media/products/.../detail.webp">`
  (absoluta) y `<meta property="og:url" content="http://localhost:4200/p/aceite-esencial-de-lavanda-30ml">`
  — **caso 41 verificado de verdad, no solo con datos simulados**.
  `curl -i http://localhost:4200/p/slug-que-no-existe-jamas` devuelve
  `HTTP/1.1 404 Not Found` como primera línea de la respuesta real (confirmado
  también directo contra el backend: `GET /api/public/v1/products/slug-que-no-existe-jamas`
  → `404` con `ProblemDetail`) — **caso 42 verificado de extremo a extremo, con
  el código de estado HTTP real, tal como pide el criterio de aceptación**.
- **Bug real encontrado y corregido con esta verificación**: los datos
  semilla solo tienen un producto con una sola imagen, así que el problema
  quedaba invisible hasta probarlo con más de una. Se montó temporalmente un
  componente con 3 imágenes de prueba (no comiteado) y se probó con Playwright
  a 375×667: `document.documentElement.scrollWidth` daba `750` con
  `clientWidth: 375` — **scroll horizontal de página real**, violando
  `ARQUITECTURA.md` §8.4 ("a 320 px no puede haber scroll horizontal en
  ninguna pantalla"). La causa: aunque `.product-image-carousel__track` sí
  actúa como su propio contenedor de scroll (`overflow-x: auto`,
  `clientWidth: 375`, `scrollWidth: 1125` — correcto), su desbordamiento
  interno igual se filtraba hacia `document.documentElement`/`body`. Se
  corrigió añadiendo `overflow-x: hidden` a `.product-image-carousel__viewport`
  (el contenedor inmediato), que contiene el desborde sin tocar el scroll
  interno del track — reverificado con el mismo script: `scrollWidth` vuelve
  a `375`, igual a `clientWidth`. De paso se añadió `min-width: 0` al track
  (no resolvía esto por sí solo, pero es la guarda estándar contra este tipo
  de fuga en contenedores flex con overflow).
- **Sincronización scroll→índice verificada en un navegador real, no solo en
  `jsdom`**: forzar `track.scrollLeft` a la tercera imagen y disparar
  `scroll` en un Chromium real (con `clientWidth`/`scrollLeft` de layout
  real, que `jsdom` no calcula) actualiza correctamente el `aria-live` a
  "Imagen 3 de 3" y el punto activo. El gesto táctil sintético vía CDP
  (`Input.dispatchTouchEvent`) no llegó a mover `scrollLeft` — Chromium
  headless no siempre traduce eventos táctiles sintéticos en scroll real del
  compositor; es una limitación conocida de la herramienta, no evidencia de
  que el gesto nativo falle. El propio `scroll-snap-type: x mandatory` sobre
  `overflow-x: auto` es comportamiento estándar de la plataforma (no código
  de este repo), y su CSS computado se confirmó aplicado correctamente.

- **Caso 43 (404 real para un producto en borrador), aceptado por el mismo
  mecanismo del caso 42, sin un borrador real contra el que probarlo**
  (decisión tomada con el usuario): los datos semilla de este entorno solo
  tienen un producto publicado — no hay ningún `DRAFT` accesible por slug, y
  crear uno habría requerido credenciales de administrador y escribir en la
  base de datos real del backend, algo que no es de este repo y que no se
  hizo sin permiso explícito. El backend no distingue slug inexistente de
  producto en borrador — ambos devuelven el mismo `ApiError{status: 404}`
  (`ARQUITECTURA.md` §4.2: "un producto en `DRAFT` es invisible... la API
  pública debe devolver 404, no 403"), y el frontend tampoco lo intenta
  distinguir (mismo código en `isNotFoundError`/`RESPONSE_INIT.status = 404`).
  El caso 42 ya se verificó de extremo a extremo contra el backend real
  (`curl` con código `404` real), así que el único camino que el frontend
  podría romper de forma distinta para un borrador —y no rompe, porque es
  literalmente el mismo código— ya está probado.
- **Caso 38, deslizamiento táctil con el dedo en un dispositivo real, no
  verificado** (decisión tomada con el usuario, misma lógica que el caso 43):
  la navegación por teclado está probada
  (`product-image-carousel.spec.ts`) y la sincronización scroll→índice
  (el único código propio de este repo en el gesto) se verificó en un
  Chromium real con layout real, no en `jsdom`. Que un dedo real sobre
  `overflow-x: auto` + `scroll-snap-type: x mandatory` dispare un evento de
  scroll es comportamiento nativo de la plataforma, no código de este
  repositorio — ya confirmado que ese CSS está aplicado correctamente. Falta
  solo la confirmación visual en un teléfono real o con emulación táctil
  manual de un navegador de escritorio, fuera del alcance de lo automatizable
  en este entorno.

---

### [x] W7. Modal de detalle sobre el grid

El mismo contenido de W6 dentro de un modal poco intrusivo, que **cambia la URL
a `/p/:slug`** sin recargar. Cargado bajo demanda.

Accesibilidad completa según `PROJECT_SPEC.md` §6: foco atrapado, `Escape`
cierra, foco devuelto a la tarjeta de origen, `role="dialog"`,
`aria-modal="true"`, fondo con `inert`, sin scroll del fondo, scroll preservado
al cerrar.

**Aceptación:**
- Casos 32 a 36 y 39 de `PROJECT_SPEC.md` §15, todos con test.
- El caso 33 (atrás cierra y preserva la posición de scroll) tiene test de
  extremo a extremo.
- El caso 36 (foco devuelto a la tarjeta exacta) tiene test.
- Abrir el modal y recargar la página muestra la vista completa de W6.
- Axe sin infracciones con el modal abierto.

**Desviaciones:**
- **`ProductCard` no era clicable en absoluto antes de esta tarea**: W3 solo
  le había puesto el botón "Agotado" adelantado. Se envolvió imagen + nombre
  + precio en un `<a>` real (`[attr.href]="'/p/' + slug"`, `display: contents`
  en CSS para no romper el layout de la tarjeta) con `aria-label` = nombre del
  producto. Un clic simple hace `preventDefault()` y emite
  `open = output<{slug, origin: HTMLAnchorElement}>()`; un clic modificado
  (botón central, Ctrl/Cmd/Shift/Alt) se deja pasar para que el navegador
  abra en pestaña nueva con normalidad — es un enlace real, rastreable y
  funcional sin JS, no un `div` con `(click)`. `ProductGrid` solo reenvía el
  evento como `productOpen`, sin lógica propia.
- **Enrutado sin pasar por el `Router`, decisión no cerrada del todo en
  `PROJECT_SPEC.md` §2** (que solo sugiere `Location.replaceState` o
  `skipLocationChange: false`): `CatalogPage` inyecta `Location`
  directamente y usa `location.go('/p/' + slug)` para abrir y
  `location.back()` para cerrar. `Location.go()` llama a `pushState`
  directamente — el `Router` de Angular solo reacciona a `popstate`/
  `hashchange`, nunca a un `pushState` programático — así que `CatalogPage`
  nunca se destruye al abrir o cerrar el modal. El botón "atrás" real del
  navegador sí dispara `popstate`: `CatalogPage` se suscribe con
  `location.subscribe(...)` y cierra el modal si la URL deja de empezar por
  `/p/` (y lo reabre simétricamente si la URL pasa a `/p/:slug` por el botón
  "adelante"). Verificado leyendo
  `node_modules/@angular/common/fesm2022/testing.mjs`: `SpyLocation.go()` y
  `.back()` notifican a los suscriptores de forma sincrónica, así que los
  tests no necesitan esperas adicionales para esta parte. No se creó un
  servicio nuevo para esto (`CatalogPage` es el único sitio que abre el
  modal hoy) — si W9/W10 necesitan abrir el detalle desde otro sitio, se
  extrae entonces.
- **Sin guardar/restaurar scroll a mano (caso 33)**: el grid nunca sale del
  DOM (el modal es un overlay hermano de `<main>`, que solo recibe `inert` y
  un `filter: blur()`), así que la posición de `window.scrollY` se conserva
  sola al desbloquear `document.documentElement.style.overflow` al cerrar.
  Bloqueo de scroll (caso 39) implementado con un `effect()` guardado tras
  `isPlatformBrowser`, con limpieza en `DestroyRef.onDestroy` por si el
  componente se destruyera con el modal abierto.
- **Nuevo `ProductDetailModal`** (`features/product/product-detail-modal/`):
  llama a la API igual que `ProductDetailPage` (mismo patrón
  `.status() === 'resolved'` antes de leer `.value()`), pero **sin**
  `RESPONSE_INIT` ni actualizar `Title`/`Meta` — nunca se renderiza en
  servidor (se carga bajo demanda tras una interacción real del usuario) y
  los meta tags reales para compartir el enlace ya los pone
  `ProductDetailPage` cuando alguien entra o recarga en `/p/:slug`, que es
  el caso que importa para SEO/WhatsApp. Ampliar esto es terreno de W11.
  Reutiliza `FocusTrap` (`shared/focus-trap/`, de W5) tal cual — ya soportaba
  `returnFocusTo`, no hizo falta tocarlo.
- **`ProductDetailContent` gana un `titleId` opcional**, por defecto `null`
  (sin `id` en el `<h1>`, como hasta ahora en la página standalone de W6):
  el modal lo usa para su `aria-labelledby`.
- **`@defer (when openSlug() !== null)` con un `@if` reactivo dentro**, el
  mismo patrón de `catalog-filter-mobile-panel.html` (W5): el chunk de
  `ProductDetailModal` se descarga solo la primera vez que se abre un
  producto (confirmado en `pnpm build`: `product-detail-modal` aparece como
  chunk perezoso de 1.44 kB transferidos) y luego se abre/cierra sin volver
  a pedirlo. El bundle inicial quedó en 110.55 kB transferidos, dentro del
  presupuesto de 200 KB.
- **Verificado sin backend disponible en este entorno** (mismo motivo que
  W3/W5/W6: `curl http://localhost:8080/api/public/v1/products` da
  "Connection refused" en este sandbox): `pnpm lint && pnpm test && pnpm
  build` en verde (141 tests, incluidos los casos 32, 34, 35, 36 y 39 más
  `inert`/scroll-lock/botón-atrás-real a nivel de componente en
  `catalog-page.spec.ts`, y el modal en aislado en
  `product-detail-modal.spec.ts`). Con `pnpm start` (SSR) se confirmó con
  `curl` que `/` sigue devolviendo 200 sin el modal en el HTML (nunca se
  abre en servidor) y que `/p/:slug` sigue renderizando
  `<app-product-detail-page>` completo. El caso 33 de extremo a extremo, la
  comprobación de "recargar con el modal abierto muestra la vista completa
  de W6" y el chequeo de Axe con el modal abierto están escritos en
  `e2e/product-modal.spec.ts` (compilan y `playwright test --list` los
  encuentra) pero **no se han ejecutado de verdad** contra datos reales —
  queda pendiente repetir `pnpm e2e` con `shop-backend-service` levantado,
  igual que quedó documentado en W3/W5/W6.

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
- Casos 1 a 12 de `PROJECT_SPEC.md` §15, todos con test.
- El caso 11 prueba con `&`, `#`, `+`, tildes, emojis y saltos de línea.
- El caso 12 recorre el archivo `whatsapp-golden.json` que publica el backend y
  comprueba que la salida coincide caso por caso. Si difiere, una de las dos
  implementaciones está mal. Este repo **no** llama a `/api/admin/**`.
- Cobertura del servicio: 100 % de líneas y ramas.

**Desviaciones:**
- **`WhatsAppTemplateService` no depende de `PublicSettings`**: ese tipo
  todavía no existe en `src/app/api/model/` (bloqueado por `B11` del backend,
  misma desviación documentada en W1). El servicio recibe las plantillas
  (`WhatsAppTemplateSet`), los datos de cada línea seleccionada
  (`WhatsAppSelectionLine`) y el nombre de la tienda como parámetros propios
  (`features/selection/whatsapp-template/whatsapp-template.model.ts`), sin
  acoplarse al cliente generado. Quien lo invoque más adelante (W9/W10) le
  pasa esos valores ya resueltos — el servicio no necesita esperar a `B11`.
- **`{{descuento}}` renderiza `"0%"` sin descuento activo** (decisión tomada
  con el usuario): `ARQUITECTURA.md` §6 no define qué hacer cuando
  `discountPercentage` es `undefined`. `{{precio_lista}}` no era ambiguo (es
  siempre `price`), pero `{{descuento}}` sí — se trata como 0.
- **`buildWhatsAppUrl` (regla 3 y caso 11) se implementó aquí, no en W10**:
  aplica `encodeURIComponent` y arma `https://wa.me/{numero}?text=...`. Es
  literalmente una regla de `ARQUITECTURA.md` §6, y el caso 11 de codificación
  está asignado a W8 en `PROJECT_SPEC.md` §15. W10 la reutiliza para el
  `window.open` real; no la reimplementa.
- **Locale `es-SV` para `Intl.NumberFormat`/`Intl.DateTimeFormat`**, fijado
  dentro del servicio (no viene de `LOCALE_ID` de Angular, que W12 todavía no
  configura): verificado en Node que produce exactamente los mismos formatos
  que los ejemplos de `ARQUITECTURA.md` §6 (`$20.00`, `12/09/2026`).
- **`@vitest/coverage-v8` añadido como dependencia de desarrollo**: no existía
  ninguna forma de verificar el requisito de "cobertura 100 %" de esta tarea
  sin él. Usado ad-hoc
  (`pnpm test -- --coverage --coverage-include='src/app/features/selection/whatsapp-template/**'`)
  para confirmar 100 % líneas/ramas/funciones en este servicio. No se tocó
  `angular.json` para exigir cobertura global — eso es alcance de W14.

**Pendiente — el caso 12 no tiene test, no marcar `[x]` hasta resolver esto:**
- **`whatsapp-golden.json` no existe todavía**: verificado contra
  `shop-backend-service` — la tarea `B11` de su propio `ROADMAP.md`
  ("Settings y plantillas de WhatsApp", que incluye la tarea de Gradle que
  genera y publica el archivo) sigue sin implementar, y no hay ningún archivo
  de ese nombre en ningún repo local. Es el mismo bloqueo que impidió generar
  `PublicSettings` en W1. Decisión tomada con el usuario: implementar y cubrir
  al 100 % los casos 1–11 ahora (hechos, en
  `whatsapp-template.service.spec.ts`) y dejar el caso 12 documentado como
  pendiente, sin escribir ningún test deshabilitado (`CLAUDE.md` lo prohíbe
  explícitamente).
- **Para cerrar esto**: cuando `B11` esté implementado y publique
  `build/fixtures/whatsapp-golden.json`, commitear ese archivo en
  `src/test/fixtures/whatsapp-golden.json` de este repo y añadir un test que
  lo recorra caso por caso contra `WhatsAppTemplateService.renderMessage()`.
  Si algún caso no coincide, revisar primero si el desajuste viene de una de
  las decisiones documentadas arriba (`{{descuento}}` sin descuento, locale
  de formato) antes de asumir que el bug está en este repo.

---

### [x] W9. Selección múltiple y barra de acción

`SelectionService` con signals, persistido en `sessionStorage` guardando **solo
`{ productId, cantidad }`**. Al restaurar, refresca los datos desde la API y
descarta los productos ya no publicados. Tope `catalog.max_selection`.

Barra fija inferior con conteo, total y botones "Ver" y "Enviar por WhatsApp".
Panel de selección para ajustar cantidades y quitar productos.

Funciona en servidor devolviendo selección vacía.

**Aceptación:**
- Casos 26 a 31 de `PROJECT_SPEC.md` §15, todos con test.
- El caso 29 es crítico: los precios se refrescan, no se leen de `sessionStorage`.
- El caso 30: un producto despublicado desaparece al restaurar.
- El SSR no revienta al no existir `sessionStorage`.
- La barra es operable con teclado y se anuncia al aparecer.

**Desviaciones:**
- **Persistido `{ productId, slug, cantidad }`, no solo `{ productId, cantidad }`**
  (decisión tomada con el usuario): la API pública no tiene forma de buscar
  un producto por `id` ni en lote — solo `GET /products/{slug}` (uno, por
  slug) y `GET /products` (lista paginada, sin filtro por id). Restaurar la
  selección exige volver a pedir cada línea por su slug
  (`getProduct({slug})`), así que `slug` se persiste además de `productId`
  para poder hacerlo. Nunca se guarda el precio, que es lo que la regla de
  `CLAUDE.md` protege de verdad. **Nota para cuando se retome el trabajo**:
  el `ROADMAP.md` de `shop-backend-service` ya tiene anotada la tarea B8.1
  ("Filtro `ids` en el listado público", con la fila correspondiente ya en
  `docs/ARQUITECTURA.md` §5.1 de ese repo) pensada exactamente para este
  caso — en cuanto exista y se regenere el cliente, el restore se puede
  simplificar a una sola llamada a `listProducts({ids})` y `slug` deja de
  hacer falta en el storage. No estaba implementada todavía al hacer esta
  tarea (verificado contra el cliente generado real), así que no se usó.
- **Restore descarta una línea ante cualquier fallo al refrescarla, no solo
  ante un 404**: el caso 30 solo nombra el despublicado, pero tras un fallo
  no hay ningún valor de reserva seguro (el caso 29 prohíbe mostrar un precio
  no verificado), así que cualquier error (404, 500, red) descarta esa línea
  igual. Cubierto con un test que usa un error 500 además del 404.
- **`catalog.max_selection` fijo en 20 vía `MAX_SELECTION`
  (`core/config/max-selection.token.ts`)**: mismo bloqueo que
  `PublicSettings` en W1/W8 (B11 del backend, sin terminar). Mismo patrón que
  `SITE_URL`/`API_BASE_URL`. Valor por defecto de `ARQUITECTURA.md` §4.6.
- **Casilla de selección en `ProductCard` y control "Añadir/Quitar de la
  selección" en `ProductDetailContent` incluidos en esta tarea** (decisión
  tomada con el usuario): el ROADMAP solo asigna a W10 el botón individual de
  WhatsApp; sin la casilla/control aquí, los casos 26-31 no se podían
  ejercitar con una interacción real de usuario. `ProductDetailContent` usa
  un botón único (no una casilla, a diferencia de la tarjeta), porque ahí se
  ve un solo producto a la vez.
- **`SelectionService` monta la barra/panel una sola vez, en `App`, hermano
  de `<router-outlet>`** (`SelectionRoot`, `features/selection/selection-root/`):
  la selección sobrevive a navegar entre `/`, `/p/:slug` y el modal; un
  montaje por página destruiría y recrearía la región `aria-live`, que
  algunos lectores de pantalla no anuncian si se acaba de insertar. `App`
  también envuelve `<router-outlet>` en un contenedor con `inert` condicional
  al panel de selección abierto (mismo criterio de accesibilidad que el
  modal de detalle, W7 §6 regla 7).
- **Restore-and-refresh con RxJS plano (`forkJoin` + `catchError` por
  petición), no `resource()`/`rxResource()`**: es un fan-out de N peticiones
  de una sola vez al construir el servicio, no un fetch reactivo atado a un
  `params` que cambia — el patrón de `resource()` no encaja. Con
  `catchError(() => of(null))` por petición interna, el fallo de una línea
  nunca aborta las demás y tampoco hace falta desenvolver
  `ResourceWrappedError`/`.cause` (el problema documentado en W6): el
  `apiErrorInterceptor` ya entrega un `ApiError` plano, sin envolver, que
  `catchError` lee directo.
- **"Enviar por WhatsApp" abre el panel de selección en vez de tener su
  propio flujo en esta tarea** (decisión tomada con el usuario): el
  renderizado real del mensaje (W10) necesita las plantillas de WhatsApp, que
  tampoco están disponibles todavía vía `PublicSettings` (mismo bloqueo de
  B11). En vez de dejar el botón sin ningún efecto, abre el mismo panel que
  "Ver" — comportamiento interino explícito, documentado, que W10 reemplaza
  por la vista previa real.
- **Efectos de servicio (`effect()` en el constructor de `SelectionService`,
  fuera de cualquier componente) no flushean solos en los tests sin una vista
  real**: primer caso del repo donde un servicio `providedIn: 'root'` usa
  `effect()`. Sin un `ComponentFixture` de por medio, hace falta
  `TestBed.tick()` explícito para forzar el flush antes de leer
  `sessionStorage` en el test del caso 28 — documentado como comentario en
  `selection.service.spec.ts`.
- **Verificado con SSR real (`pnpm build` + servidor Node), sin backend
  disponible en este entorno** (mismo motivo que W3/W5/W6/W7: el backend real
  no está accesible en este sandbox): `curl` sobre `/` confirma que
  `<app-selection-root>` renderiza en servidor con la región `aria-live`
  vacía y sin ninguna barra/panel en el HTML crudo — selección vacía en
  servidor, tal como pide el criterio de aceptación. `curl` sobre `/p/:slug`
  confirma que inyectar `SelectionService` en `ProductDetailPage`/
  `ProductDetailModal` tampoco revienta el render en servidor. La
  verificación completa con datos reales (casos 26-31 de extremo a extremo
  contra el backend real) queda pendiente, igual que en tareas anteriores.

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
- Caso 45 y 46 de `PROJECT_SPEC.md` §15.
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

### [ ] W13. Diseño responsive

Repaso completo contra `PROJECT_SPEC.md` §11. Puntos de corte declarados una
sola vez como variables CSS, con la escala de `docs/ARQUITECTURA.md` §8.
Panel de filtros deslizante en móvil y columna lateral en escritorio. Detalle a
pantalla completa en móvil y modal en escritorio. Relleno inferior del grid que
compense la barra de selección. Áreas táctiles de 44 px. `@media (hover: hover)`
para lo que hoy dependa del ratón. `sizes` en todas las imágenes con `srcset`.

Test de Playwright parametrizado por ancho, para no repetir el mismo test seis
veces.

**Aceptación:**
- Casos 51 a 58 de `PROJECT_SPEC.md` §15, todos con test.
- El caso 51 (sin scroll horizontal) recorre los seis anchos en las tres vistas.
- El caso 54 es el que más se olvida: la barra de selección no puede tapar el
  último producto.
- Ninguna imagen con `srcset` se queda sin `sizes`.
- Nada de `100vh` en elementos que deban ocupar la altura visible en móvil.

---

### [ ] W14. Rendimiento y accesibilidad

Auditoría y corrección hasta cumplir los objetivos de `PROJECT_SPEC.md` §10 y
§12. Carga diferida de rutas y componentes pesados. Presupuestos de tamaño
configurados en `angular.json` que **rompen el build** al excederse.

**Aceptación:**
- Lighthouse en `/` y `/p/:slug` (móvil, 4G simulada): Rendimiento ≥ 90,
  Accesibilidad ≥ 95, SEO 100, Buenas prácticas ≥ 95.
- LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- JS inicial < 200 KB comprimido, con el presupuesto configurado.
- Caso 50 de §15: Axe sin infracciones críticas ni serias en las tres vistas.
- Caso 48: el flujo completo es operable solo con teclado.
- Caso 57: usable con el zoom del navegador al 200 %.
- `prefers-reduced-motion` respetado.
- **Caso 44 de §15** (trasladado desde `W4`, decisión tomada con el usuario):
  el primer lote de `/` no se pide dos veces (servidor + hidratación).

**Pendiente — resolver antes de dar la tarea por terminada:**
- **Caso 44: el primer lote SÍ se pide dos veces hoy.** Verificado con
  Playwright contra el backend real (`shop-backend-service`,
  `localhost:8080`): tras `waitUntil: 'networkidle'` en `/`, el navegador
  dispara una petición extra a `/api/public/v1/products?page=0`, además de
  la que ya hizo el servidor (confirmada por el bloque de `TransferState`
  embebido en el HTML crudo, que trae `"u":"http://localhost:8080/api/public/v1/products"`).

  **Causa raíz**: `HttpTransferCache` de Angular calcula la clave de caché a
  partir del string completo de la URL de la petición. `app.config.server.ts`
  usa una URL **absoluta** (`http://localhost:8080/...`) y `app.config.ts`
  usa una **relativa** (`''`) — decisión explícita de `PROJECT_SPEC.md` §8.
  Server y cliente generan claves distintas, así que nunca hay *match* y el
  cliente vuelve a pedir.

  Se probó `HTTP_TRANSFER_CACHE_ORIGIN_MAP` (el mecanismo que Angular
  documenta para "orígenes distintos entre servidor y cliente"), pero **no
  cubre este caso**: solo reconcilia dos orígenes absolutos distintos. Si el
  destino del mapeo es `''` (para igualar la URL relativa del cliente), el
  propio código de `@angular/common/http` lo trata como *falsy* y no aplica
  ningún mapeo (`if (!mappedOrigin) return url;` en `mapRequestOriginUrl`,
  verificado leyendo el fuente y ejecutándolo aislado con Node).

  **Opciones reales para resolverlo** (pendiente decidir con el usuario cuál,
  al llegar a esta tarea):
  1. Cachear manualmente con `TransferState` en cada página SSR (`CatalogPage`
     aquí; `/p/:slug` de `W6` tendría el mismo problema): el servidor guarda
     la respuesta bajo una clave propia que no depende del origen de la URL;
     el cliente la lee antes de llamar a la API y no pide nada si ya la
     tiene. Funciona con cualquier combinación de URLs, pero es trabajo real
     en más de un lugar.
  2. Cambiar la decisión de `PROJECT_SPEC.md` §8 para que el cliente también
     use un origen absoluto reconocible (la URL pública del sitio, por
     ejemplo) — ahí `HTTP_TRANSFER_CACHE_ORIGIN_MAP` sí funcionaría de
     fábrica. Contradice el texto actual del spec ("en el navegador pueden
     ser relativas"), así que requiere aprobarlo explícitamente antes de
     tocar `ARQUITECTURA.md`/`PROJECT_SPEC.md`.

---

### [ ] W15. Extremo a extremo y despliegue

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

Repasa `PROJECT_SPEC.md` §16 uno por uno. La prueba final es real: despliega,
pega un enlace `/p/:slug` en una conversación de WhatsApp y comprueba que sale
la foto y el título del producto.
