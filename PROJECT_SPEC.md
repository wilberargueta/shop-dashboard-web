# shop-dashboard-web — Especificación

> Lee primero `docs/ARQUITECTURA.md`. Ahí están el modelo de dominio, el
> contrato de API completo y las decisiones cerradas. Este documento cubre
> **solo el sitio público**.

---

## 1. Qué construye este repositorio

El sitio que ve el visitante. Angular 22 con renderizado en servidor (SSR).

**Sin registro, sin login, sin carrito, sin pagos.** El visitante navega el
catálogo, selecciona productos y se va a WhatsApp con un mensaje ya escrito.

Solo consume `/api/public/v1/**` y `/media/**`. **Nunca** llama a
`/api/admin/**`: no tiene credenciales ni debe tenerlas.

---

## 2. Pantallas

Son pocas. La complejidad está en el grid y en el selector de WhatsApp, no en
la cantidad de vistas.

| Ruta | Qué es |
|---|---|
| `/` | Catálogo. Es la pantalla principal y donde ocurre casi todo. |
| `/p/:slug` | Detalle de producto. Ruta real, con SSR, para que el enlace compartido por WhatsApp abra bien. |
| `/404` | No encontrado. |

**Decisión importante sobre el detalle:** el usuario pidió que al hacer clic en
un producto se abra un modal poco intrusivo. Se hace así, **pero el modal
cambia la URL a `/p/:slug`** (con `Location.replaceState` o navegación con
`skipLocationChange: false`). De esa forma:

- Compartir el enlace funciona: quien lo abre ve la página completa renderizada
  en servidor, con sus meta tags y su imagen de vista previa en WhatsApp.
- El botón "atrás" del navegador cierra el modal, que es lo que la gente espera.
- El enlace `{{url}}` de la plantilla de WhatsApp apunta a algo real.

Si el visitante llega directo a `/p/:slug`, ve la página completa. Si llega
navegando desde el grid, ve el modal sobre el grid. Mismo componente de
contenido en ambos casos.

---

## 3. El grid de catálogo

### Disposición

- Escritorio (≥1024 px): **3 columnas**.
- Tableta (768–1023 px): 2 columnas.
- Móvil (<768 px): 1 columna.

Las 3 columnas son el requisito; las otras son la adaptación razonable. CSS Grid
con `repeat(auto-fill, minmax(...))` o breakpoints explícitos.

### Scroll infinito

Carga por lotes conforme el visitante baja. Requisitos:

1. **`IntersectionObserver`** sobre un elemento centinela al final de la lista,
   no un listener de `scroll` (que dispara decenas de veces por segundo).
2. **Indicador de carga** visible mientras llega el siguiente lote. El usuario
   lo pidió explícitamente: un spinner o, mejor, tarjetas esqueleto con la misma
   forma que las reales, para que el layout no salte.
3. **Sin saltos de layout (CLS).** Cada tarjeta reserva el espacio de su imagen
   con `aspect-ratio` antes de que la imagen cargue.
4. **Una sola petición en vuelo.** Si el visitante baja rápido, no se disparan
   cinco peticiones de la misma página.
5. **Fin de lista explícito**: cuando `hasNext` es `false`, se muestra
   "No hay más productos" y el observer se desconecta.
6. **Error recuperable**: si un lote falla, se muestra un botón "Reintentar",
   no una pantalla en blanco ni un bucle de reintentos.
7. **Enlace de respaldo accesible**: un botón "Cargar más" real, aunque esté
   visualmente oculto, para navegación por teclado y lectores de pantalla. El
   scroll infinito puro es una trampa de accesibilidad.
8. **Al cambiar cualquier filtro, la lista se reinicia** desde la página 0 y el
   scroll vuelve arriba.

### SSR y scroll infinito

El servidor renderiza **solo el primer lote**. Los siguientes se cargan en el
navegador. Esto es lo correcto: el rastreador y el primer pintado necesitan el
primer lote, no los 200 productos.

Para que el primer lote no se pida dos veces (una en servidor y otra al
hidratar), usa la transferencia de estado de Angular. Con `httpResource` y la
hidratación de Angular 22 esto funciona por defecto; **verifícalo mirando la
pestaña de red**, no lo des por hecho.

---

## 4. Filtros, búsqueda y ordenamiento

Todo el estado de navegación vive en los **parámetros de la URL**. Eso hace que
el estado sea compartible, que el botón atrás funcione y que el SSR pueda
renderizar la vista filtrada.

```
/?category=aceites&category=cremas&minPrice=10&maxPrice=50&q=lavanda&sort=price,asc&onSale=true
```

| Control | Comportamiento |
|---|---|
| **Categorías** | Casillas múltiples. Muestra el conteo por categoría. Varias seleccionadas = OR. |
| **Rango de precio** | Dos campos numéricos o un control deslizante doble. Se aplica sobre el precio efectivo. Validación: mínimo ≤ máximo. |
| **Búsqueda** | Campo de texto con **debounce de 300 ms**. Sin debounce disparas una petición por tecla y el límite de peticiones del backend te corta. |
| **Ordenar** | Desplegable: Destacados, Nombre A-Z, Nombre Z-A, Precio menor, Precio mayor, Más recientes, Relevancia (solo con búsqueda activa). |
| **Solo ofertas** | Interruptor. |
| **Limpiar filtros** | Visible solo cuando hay algún filtro activo; dice cuántos hay. |

En móvil los filtros van en un panel lateral o inferior que se abre con un
botón, con el número de filtros activos en una insignia. Ocupar media pantalla
con filtros en un móvil es peor que ocultarlos.

**Estado vacío:** cuando ningún producto coincide, se muestra un mensaje claro
con un botón para limpiar filtros. No una lista vacía sin explicación.

---

## 5. La tarjeta de producto

Contiene, y nada más:

- Imagen (versión `card`), con `aspect-ratio` reservado y `alt` real.
- Nombre del producto (máximo 2 líneas, con elipsis).
- Precio. Si hay descuento: precio de lista tachado + precio efectivo destacado
  + insignia con el porcentaje ("-20%").
- Indicador de agotado, si aplica.
- Casilla o botón de selección para el pedido múltiple.
- Botón de WhatsApp para pedido individual.

### Imágenes

```html
<picture>
  <source type="image/webp"
          srcset="...card.webp 600w, ...card2x.webp 1200w"
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw">
  <img src="...card.jpg"
       srcset="...card.jpg 600w, ...card2x.jpg 1200w"
       sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
       alt="..." width="600" height="600" loading="lazy" decoding="async">
</picture>
```

**El `sizes` no es opcional.** Sin él, el navegador asume que la imagen ocupa el
ancho completo de la ventana y, en un grid de 3 columnas, descarga siempre la
versión más grande. Los valores de `sizes` deben coincidir con los puntos de
corte reales del grid: si cambias uno, cambia el otro.

- `loading="lazy"` en todas **menos en las primeras 3–6** (las del primer
  pantallazo), que llevan `loading="eager"` y `fetchpriority="high"`. Poner
  `lazy` en la imagen principal empeora el LCP.
- `width` y `height` siempre presentes, aunque el CSS los sobreescriba: es lo
  que evita el salto de layout.
- Imagen de respaldo si el producto no tiene ninguna.

### Agotados

Depende de `catalog.hide_out_of_stock`:

- `true` → el backend ni los devuelve. El frontend no hace nada.
- `false` → llegan con `inStock: false`. Se muestran con la imagen atenuada, una
  etiqueta "Agotado" y el botón de WhatsApp deshabilitado (con explicación
  accesible de por qué está deshabilitado).

---

## 6. Modal de detalle

Poco intrusivo: se abre sobre el grid, que sigue visible y difuminado detrás.
No ocupa toda la pantalla en escritorio.

**Contenido:**

- Carrusel de imágenes en versión `detail`, con navegación por flechas, puntos
  indicadores y **deslizamiento táctil** en móvil. Miniaturas debajo en escritorio.
- Nombre, SKU, precio (con descuento si aplica), disponibilidad.
- Descripción (HTML saneado por el backend).
- Instrucciones de uso — **solo si el producto las tiene**. Si vienen vacías o
  nulas, la pestaña o sección no aparece. No muestres un apartado vacío.
- Selector de cantidad.
- Botón de WhatsApp y botón "Añadir a la selección".

**Requisitos de accesibilidad del modal** (esto se rompe siempre, y es lo que
separa un modal aceptable de uno molesto):

1. El foco pasa al modal al abrirse y **queda atrapado dentro** mientras está
   abierto.
2. `Escape` lo cierra.
3. Al cerrarse, el foco vuelve **exactamente** a la tarjeta desde la que se abrió.
4. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apuntando al título.
5. El fondo no hace scroll mientras el modal está abierto — y al cerrarlo, la
   página queda donde estaba, no al principio.
6. El carrusel se navega con las flechas del teclado y anuncia "imagen 2 de 5".
7. El contenido detrás lleva `inert` o `aria-hidden`.

**Renderizado del HTML de la descripción:** aunque el backend ya lo saneó, el
frontend usa `DomSanitizer` con una lista blanca. Defensa en dos capas. Nunca
`bypassSecurityTrustHtml` con contenido que venga de la API.

---

## 7. Selección múltiple y redirección a WhatsApp

Esta es la funcionalidad que define el proyecto. Merece su propio cuidado.

### Selección

- Cada tarjeta tiene una casilla de selección. El modal tiene "Añadir a la
  selección" con cantidad.
- La selección vive en un servicio con signals y se **persiste en
  `sessionStorage`** (no `localStorage`: es una intención de compra puntual, no
  algo que deba sobrevivir días).
- **Guarda solo `{ productId, cantidad }`**, nunca el precio. Al restaurar la
  selección se refrescan los datos desde la API. Si guardaras el precio y el
  administrador lo cambia, el visitante enviaría un mensaje con un precio que ya
  no existe.
- Si un producto de la selección ya no está publicado al restaurarla, se elimina
  silenciosamente de la selección.
- Tope de `catalog.max_selection` productos.

### Barra de selección

Fija abajo, visible solo cuando hay algo seleccionado:

```
[3 productos · $65.00]          [Ver]  [Enviar por WhatsApp]
```

"Ver" abre un panel con las líneas seleccionadas, permite cambiar cantidades y
quitar productos.

### Envío

**Un producto** → plantilla `template_single`.
**Varios** → `template_multi_header` + una línea `template_multi_item` por
producto + `template_multi_footer`.

El renderizado ocurre en el navegador, con la plantilla y el número que vienen
de `GET /api/public/v1/settings`. Las reglas de renderizado y los 9 marcadores
por producto + 5 globales están en `ARQUITECTURA.md` §6 — **impleméntalas
exactamente igual que el backend**, porque el preview del backoffice usa la
implementación del backend y ambos deben producir el mismo texto.

Reglas que hay que respetar:

1. Marcador desconocido → se deja literal.
2. Marcador "por producto" en plantilla global → cadena vacía.
3. Precios formateados con el `Intl.NumberFormat` de la moneda, no concatenando `"$"`.
4. `{{url}}` es la URL **absoluta** y canónica del producto (`https://dominio/p/slug`).
5. Truncado a 1500 caracteres con "… y N productos más".
6. `encodeURIComponent` sobre el mensaje completo antes de armar
   `https://wa.me/{numero}?text={mensaje}`.
7. Se abre con `window.open(url, '_blank', 'noopener,noreferrer')`.

**Antes de redirigir**, se envía el evento `WHATSAPP_CLICK` a
`POST /api/public/v1/events` con la cantidad de productos, **sin esperar la
respuesta** (`keepalive: true` o `navigator.sendBeacon`). Si falla, se ignora:
la analítica nunca puede impedir que el visitante llegue a WhatsApp.

### Vista previa

Antes de abrir WhatsApp se muestra el mensaje renderizado con un botón
"Enviar" y otro "Copiar". Dos motivos: la redirección a WhatsApp desde un
navegador de escritorio a veces falla o abre una pestaña inútil, y ver el
mensaje antes de enviarlo le da confianza al visitante.

---

## 8. SSR

Angular 22 con `@angular/ssr`. Hidratación incremental activa por defecto.

**Qué se renderiza en servidor:**

- `/` con el primer lote de productos y los filtros aplicados según la URL.
- `/p/:slug` completo, con sus meta tags.

**Cuidados de SSR** (aquí es donde se rompe el 90 % de las aplicaciones Angular
con SSR):

- `window`, `document`, `localStorage`, `sessionStorage` y `navigator` **no
  existen en el servidor**. Todo acceso va tras `afterNextRender` o una guarda
  de plataforma. El servicio de selección debe funcionar en servidor
  devolviendo una selección vacía.
- Las URLs de la API deben ser absolutas en servidor. En el navegador pueden ser
  relativas. Configúralo por entorno.
- El servidor SSR llama al backend desde su propia IP: esa IP debe estar en
  `app.security.internal-clients` del backend, o el sitio se auto-bloqueará por
  límite de peticiones en cuanto tenga tráfico.
- `IntersectionObserver` no existe en servidor. El centinela del scroll infinito
  solo se activa tras la hidratación.
- No uses `setTimeout` ni `setInterval` sin limpiarlos: retienen el renderizado
  del servidor y la respuesta nunca se envía.

---

## 9. SEO

El sitio es público y los enlaces se comparten por WhatsApp. Esto importa.

### Meta tags dinámicos

Por página, con el servicio `Meta` y `Title` de Angular:

- `<title>` y `<meta name="description">`.
- **Open Graph**: `og:title`, `og:description`, `og:image` (versión `detail`,
  absoluta), `og:url`, `og:type`, `og:site_name`.
  Esto es lo que hace que al pegar el enlace en WhatsApp salga la foto del
  producto y no un cuadro gris.
- `<link rel="canonical">` — apuntando a la URL sin parámetros de filtro, para
  no generar contenido duplicado.
- Twitter Card: `summary_large_image`.

### Datos estructurados

JSON-LD embebido en el servidor:

- En `/p/:slug`: `Product` con `name`, `description`, `sku`, `image`, `brand`, y
  `offers` (`Offer` con `price`, `priceCurrency`, `availability` según el stock,
  `url`). Con esto Google puede mostrar el precio en los resultados.
- En `/`: `ItemList` con los productos del primer lote, y `BreadcrumbList`.
- `Organization` con el nombre y logo de la tienda, en el layout.

**Valida el resultado** con la herramienta de pruebas de resultados
enriquecidos de Google antes de dar la tarea por terminada. El JSON-LD mal
formado no da error visible: simplemente se ignora.

### Rutas técnicas

- `/sitemap.xml` — generado dinámicamente en el servidor desde los productos
  publicados y las categorías activas. Cacheado 1 hora.
- `/robots.txt` — permite todo salvo rutas con parámetros de filtro
  (`Disallow: /*?`), para no desperdiciar presupuesto de rastreo.

### URLs

`/p/:slug` con el slug del producto. Nunca ids en la URL pública. Si el slug
cambia, el backend debería servir una redirección 301 desde el antiguo — anótalo
como mejora futura, no es del alcance inicial.

---

## 10. Rendimiento

Objetivos medibles en Lighthouse (móvil, red 4G simulada), en la página `/`:

| Métrica | Objetivo |
|---|---|
| LCP | < 2.5 s |
| CLS | < 0.1 |
| INP | < 200 ms |
| Lighthouse Rendimiento | ≥ 90 |
| Lighthouse Accesibilidad | ≥ 95 |
| Lighthouse SEO | 100 |
| JS inicial (comprimido) | < 200 KB |

Cómo se consiguen:

- Imágenes WebP con `srcset`, `lazy` salvo las del primer pantallazo,
  dimensiones declaradas.
- Carga diferida de rutas. El modal de detalle y el panel de filtros móvil se
  cargan bajo demanda.
- Sin librerías de UI pesadas en el sitio público. **Angular Material va en el
  backoffice, no aquí.** El sitio público lleva CSS propio, o Tailwind si
  prefieres utilidades. Una tienda de tres pantallas no necesita un framework
  de componentes.
- Fuentes con `font-display: swap` y precarga de la principal. Mejor aún: usar
  la pila de fuentes del sistema y no cargar ninguna.
- Sin `zone.js` — Angular 22 sin zonas, con signals.

---

## 11. Diseño responsive

La escala de puntos de corte y las reglas comunes están en
`docs/ARQUITECTURA.md` §8. Aquí va lo específico de la tienda.

**Este sitio se verá mayoritariamente en móvil.** Los enlaces se comparten por
WhatsApp, y WhatsApp se usa desde el teléfono. El móvil no es el caso
degradado: es el caso principal, y el escritorio es la adaptación.

### Qué hace cada pieza en cada tamaño

| Pieza | Móvil (<768) | Tableta (768–1023) | Escritorio (≥1024) |
|---|---|---|---|
| Grid de productos | 1 columna (2 si la tarjeta sigue legible) | 2 columnas | **3 columnas** |
| Filtros | panel deslizante desde abajo, botón con insignia de filtros activos | panel deslizante lateral | columna lateral fija a la izquierda |
| Búsqueda | siempre visible en la cabecera | en la cabecera | en la cabecera |
| Detalle | a pantalla completa (el modal deja de ser modal) | modal ancho | modal centrado, grid visible detrás |
| Carrusel | una imagen, deslizamiento táctil, puntos | imagen + puntos | imagen grande + tira de miniaturas |
| Barra de selección | fija abajo, ancho completo | fija abajo | fija abajo, centrada con ancho máximo |
| Cabecera | logo + buscador + icono de filtros | completa | completa |

**El modal en móvil deja de ser un modal.** A 375 px, una ventana flotante sobre
un fondo difuminado no cabe: se vuelve una hoja a pantalla completa que sube
desde abajo, con su propio botón de cerrar. El contenido es el mismo componente;
lo que cambia es el contenedor. Esto no es un detalle estético — un modal
centrado con márgenes en un móvil deja el contenido en una columna de 300 px
con scroll interno, y se usa fatal.

### Cosas que rompen y hay que cuidar

1. **La barra de selección tapa el final de la lista.** Es fija abajo y mide unos
   64 px. Sin un relleno inferior equivalente en el contenedor del grid, los
   últimos productos quedan debajo y no se pueden pulsar. Se resuelve con un
   `padding-bottom` que dependa de si la barra está visible, más
   `env(safe-area-inset-bottom)`.
2. **Los nombres de producto largos** rompen la tarjeta a 320 px. Dos líneas con
   elipsis y `overflow-wrap: anywhere` para nombres sin espacios.
3. **Precio tachado + precio efectivo + insignia** no caben en una línea a
   320 px. Deben poder envolverse sin descolocar la tarjeta.
4. **El rango de precio** con dos campos numéricos lado a lado se estrecha
   demasiado en móvil: apílalos o usa un deslizador doble con áreas táctiles
   suficientes.
5. **El carrusel debe usar el gesto nativo**: `scroll-snap` sobre un contenedor
   con desplazamiento horizontal, no una librería que capture el táctil. Es más
   ligero, más fluido y funciona con el teclado sin trabajo extra.
6. **Hover no existe en táctil.** Cualquier cosa que solo aparezca al pasar el
   ratón (el botón de WhatsApp en la tarjeta, por ejemplo) debe estar siempre
   visible en pantallas táctiles. Detéctalo con `@media (hover: hover)`, no por
   ancho de pantalla: hay portátiles con pantalla táctil y tabletas anchas.
7. **El teclado virtual en iOS** desplaza la vista al enfocar un campo. Si la
   barra de búsqueda es fija, comprueba que no quede tapada.
8. **Las imágenes `srcset` deben declarar `sizes`.** Sin `sizes`, el navegador
   asume el ancho completo de la ventana y en un grid de 3 columnas descarga la
   imagen del tamaño equivocado, tirando por tierra la optimización.

### Verificación

Los anchos con los que se comprueba: **320, 375, 768, 1024, 1280 y 1920 px**,
más móvil en horizontal (~740×360). En ninguno puede haber scroll horizontal.

---

## 12. Accesibilidad

Objetivo: **WCAG 2.1 nivel AA**.

- Todo operable solo con teclado: filtros, grid, modal, carrusel, selección.
- Foco visible siempre. Nunca `outline: none` sin reemplazo.
- Contraste mínimo 4.5:1 en texto, 3:1 en elementos de interfaz.
- Toda imagen con `alt` con sentido; las decorativas con `alt=""`.
- El grid es una lista semántica, no un montón de `div`.
- Los cambios de la lista (nuevo lote cargado, filtro aplicado, "0 resultados")
  se anuncian con una región `aria-live="polite"`.
- Los precios con descuento se leen correctamente: el precio tachado con
  `<s>` y una etiqueta accesible que diga "precio anterior".
- Enlace "Saltar al contenido" al inicio.
- `prefers-reduced-motion` respetado en las animaciones del carrusel y el modal.

---

## 13. Internacionalización

Español único idioma, pero **preparado**:

- Todos los textos de interfaz en archivos de traducción desde el primer día.
  Cero cadenas incrustadas en plantillas o componentes.
- `@angular/localize` con `i18n` en plantillas, o `ngx-translate` — elige uno y
  sé consistente. `@angular/localize` es lo nativo y funciona bien con SSR.
- Fechas, números y moneda siempre con los pipes localizados de Angular, nunca
  con formato manual.
- `<html lang="es">`.
- Los **nombres y descripciones de productos no son traducibles** por ahora:
  vienen en un solo idioma desde la base de datos. Añadir un segundo idioma de
  contenido requeriría cambiar el modelo del backend, y eso está fuera del
  alcance actual.

---

## 14. Cliente de API

Generado desde el OpenAPI del backend. **No escribas los tipos ni los servicios
HTTP a mano.**

```bash
pnpm run api:generate    # descarga el openapi.json del backend y genera src/app/api/
```

- La carpeta generada **no se edita nunca** y se marca como generada en
  `.gitattributes`.
- Si el backend cambia un DTO, se regenera y TypeScript señala exactamente qué
  se rompió. Esa es toda la ventaja de tener tres repos separados sin
  desincronizarse.
- El generador (`openapi-generator` con `typescript-angular`, o `orval`) se fija
  por versión en `package.json`.
- Hay un script de CI que regenera y falla si el resultado difiere de lo
  commiteado: significa que alguien cambió el backend sin actualizar el cliente.

---

## 15. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | Vitest (o Jest) | Servicios: selección, renderizado de plantillas, estado de filtros, sincronización con la URL. |
| Componentes | Angular Testing Library | Tarjeta, grid, filtros, modal, barra de selección. Se prueban por lo que el usuario ve y hace, no por métodos internos. |
| Extremo a extremo | Playwright | Los flujos completos. |
| Accesibilidad | `@axe-core/playwright` | Cada pantalla principal. |

> El runner de pruebas por defecto del CLI de Angular ha ido cambiando. Verifica
> cuál trae Angular 22 al generar el proyecto y usa ese; no fuerces otro sin
> motivo.

### Casos que deben tener test

**Renderizado de plantillas de WhatsApp** (lo más importante: es la conversión)

1. Los 9 marcadores por producto se sustituyen correctamente.
2. Los 5 marcadores globales se sustituyen correctamente.
3. Marcador desconocido queda literal.
4. Marcador "por producto" en plantilla global → cadena vacía.
5. Mensaje de un producto usa `template_single`.
6. Mensaje de tres productos: encabezado + 3 líneas + pie.
7. El `{{total}}` del pie coincide con la suma de subtotales.
8. `{{subtotal}}` = precio efectivo × cantidad.
9. `{{precio}}` usa el precio efectivo, `{{precio_lista}}` el de lista.
10. Truncado a 1500 caracteres con "… y N productos más".
11. La URL final está correctamente codificada (probar con `&`, `#`, `+`, tildes,
    emojis y saltos de línea en el nombre del producto).
12. **El texto producido es idéntico al que genera el backend** con los mismos
    datos de entrada. Este test es la red de seguridad contra que las dos
    implementaciones se separen.

    Cómo se hace sin que este repo toque la API de administración: el backend
    publica un **archivo de casos de referencia** (`whatsapp-golden.json`) como
    artefacto de su build, con pares de entrada y salida esperada generados por
    su propia implementación. Aquí se commitea ese archivo en `src/test/fixtures/`
    y el test recorre sus casos. Cuando el backend cambia el renderizado,
    regenera el archivo y este test se pone rojo hasta que ambas
    implementaciones vuelvan a coincidir.

**Scroll infinito**

13. Al llegar al centinela se pide la página siguiente.
14. Mientras carga se muestra el indicador.
15. No se dispara una segunda petición con una ya en vuelo.
16. Con `hasNext: false` se muestra el fin de lista y no se pide más.
17. Un lote que falla muestra "Reintentar" y reintentar funciona.
18. Cambiar un filtro reinicia a la página 0 y sube el scroll.

**Filtros y URL**

19. Seleccionar una categoría actualiza la URL y la lista.
20. Recargar con filtros en la URL restaura exactamente ese estado.
21. El botón atrás deshace el último cambio de filtro.
22. La búsqueda tiene debounce: 5 pulsaciones rápidas = 1 petición.
23. Precio mínimo mayor que el máximo muestra error y no consulta.
24. "Limpiar filtros" deja la URL sin parámetros.
25. Sin resultados se muestra el estado vacío con el botón de limpiar.

**Selección**

26. Seleccionar y deseleccionar actualiza la barra y el total.
27. Cambiar la cantidad recalcula el total.
28. La selección sobrevive a una recarga de página.
29. Al restaurar, los precios se refrescan desde la API, no desde `sessionStorage`.
30. Un producto despublicado desaparece de la selección restaurada.
31. Se respeta el tope `catalog.max_selection`.

**Modal**

32. Abrir cambia la URL a `/p/:slug`.
33. Atrás cierra el modal y devuelve al grid en la misma posición de scroll.
34. `Escape` cierra.
35. El foco queda atrapado dentro mientras está abierto.
36. Al cerrar, el foco vuelve a la tarjeta de origen.
37. Sin instrucciones de uso, esa sección no aparece.
38. El carrusel navega con teclado y con deslizamiento táctil.
39. El fondo no hace scroll con el modal abierto.

**SSR**

40. `GET /` devuelve HTML con los productos ya renderizados (comprobar el cuerpo
    de la respuesta, no el DOM ya hidratado).
41. `GET /p/:slug` devuelve HTML con el `og:image` correcto.
42. `GET /p/slug-inexistente` devuelve **404 de verdad**, no un 200 con una
    página de error. Esto importa para el SEO.
43. `GET /p/slug-de-producto-en-borrador` devuelve 404.
44. El primer lote **no se pide dos veces** (servidor + hidratación).
45. El HTML del servidor incluye el JSON-LD válido.
46. `/sitemap.xml` devuelve XML bien formado con los productos publicados.

**Extremo a extremo con Playwright**

47. Flujo completo: entrar → filtrar por categoría → buscar → abrir un producto →
    ver las fotos → seleccionar 2 productos → ver la vista previa del mensaje →
    comprobar que la URL de WhatsApp es la correcta (interceptando `window.open`,
    sin abrir WhatsApp de verdad).
48. El mismo flujo solo con teclado.
49. El mismo flujo en viewport de móvil (375 px).
50. Axe sin infracciones críticas en `/`, en `/p/:slug` y con el modal abierto.

**Responsive** (Playwright, recorriendo los anchos de §11)

51. **Sin scroll horizontal** en `/`, `/p/:slug` y con el panel de filtros
    abierto, a 320, 375, 768, 1024, 1280 y 1920 px. Se comprueba con
    `document.documentElement.scrollWidth <= clientWidth`.
52. El grid muestra 1 columna a 375 px, 2 a 768 px y 3 a 1280 px.
53. A 375 px el detalle se abre a pantalla completa; a 1280 px como modal
    centrado con el grid visible detrás.
54. Con la barra de selección visible, el último producto del grid **queda
    pulsable**: no está tapado por la barra. Se comprueba en 375 y 1280 px.
55. Todos los controles interactivos miden al menos 44×44 px a 375 px.
56. Un nombre de producto de 120 caracteres sin espacios no desborda la tarjeta
    a 320 px.
57. Con el zoom del navegador al 200 % a 1280 px, el contenido sigue siendo
    usable y sin scroll horizontal.
58. En móvil horizontal (740×360) el detalle se puede desplazar hasta el final y
    el botón de WhatsApp es alcanzable.

### Cobertura

80 % de líneas global. **100 % en el servicio de renderizado de plantillas de
WhatsApp**: es el código que decide si una venta ocurre o no, y cabe en 100
líneas. No hay excusa para no cubrirlo entero.

---

## 16. Criterios de aceptación del repositorio completo

- [ ] `pnpm build` y `pnpm test` pasan en limpio.
- [ ] `pnpm e2e` pasa contra un backend levantado con `docker compose`.
- [ ] Los 58 casos de §15 existen y pasan.
- [ ] Lighthouse cumple los objetivos de §10 en `/` y en `/p/:slug`.
- [ ] Ninguna pantalla tiene scroll horizontal a 320, 375, 768, 1024, 1280 ni
      1920 px, ni en móvil horizontal.
- [ ] El flujo completo se puede hacer desde un teléfono de 375 px sin
      frustración: probado a mano, no solo con tests.
- [ ] Axe no reporta infracciones críticas ni serias.
- [ ] Todo el flujo principal es operable solo con teclado.
- [ ] Pegar un enlace `/p/:slug` en WhatsApp muestra la imagen y el título
      correctos (pruébalo de verdad, con el sitio desplegado).
- [ ] `src/app/api/` está generado, no escrito a mano.
- [ ] Cero cadenas de interfaz incrustadas fuera de los archivos de traducción.
- [ ] No hay `TODO`, `FIXME` ni código comentado en `main`.
