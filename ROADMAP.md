# ROADMAP — tienda-web

Tareas en orden. **Este repo depende del backend**: no empieces hasta que las
tareas B0–B4 de `tienda-backend` estén terminadas y el OpenAPI sea generable.

Marca `[x]` al completar y anota desviaciones.

---

## Fase 0 — Cimientos

### [ ] W0. Esqueleto del proyecto con SSR

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

---

### [ ] W2. Estado de navegación en la URL

Servicio `CatalogQueryService` que lee y escribe los parámetros de la URL
(`page`, `size`, `sort`, `q`, `category[]`, `minPrice`, `maxPrice`, `onSale`,
`inStock`) exponiéndolos como signals.

Validación y saneado de los parámetros que llegan de la URL: un `sort`
inventado o un `minPrice` no numérico se ignoran, no rompen la página.

**Aceptación:**
- Casos 19, 20, 21 y 24 de `PROJECT_SPEC.md` §14.
- Una URL con parámetros basura renderiza el catálogo sin filtros, sin errores.
- Funciona en servidor: el SSR lee los parámetros y renderiza filtrado.

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
