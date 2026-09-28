# Arquitectura y dominio compartido — Catálogo con pedidos por WhatsApp

> **Este archivo es la fuente de verdad compartida por los tres repositorios.**
> Cópialo en `docs/ARQUITECTURA.md` dentro de cada repo. Si algo cambia aquí,
> debe cambiar en las tres copias en el mismo commit lógico.

---

## 1. Qué es este sistema

Un catálogo de productos en línea donde:

- El público navega productos **sin registrarse ni iniciar sesión**.
- No hay carrito de compra ni pasarela de pago. El cierre de la venta ocurre
  **fuera del sistema**, en WhatsApp: el visitante selecciona uno o varios
  productos y el sitio lo redirige a WhatsApp con un mensaje pre-armado.
- Un equipo interno administra el catálogo desde un backoffice protegido.

**Consecuencia de diseño más importante:** el sistema no maneja dinero ni datos
personales del comprador. Eso reduce muchísimo la superficie de riesgo y
simplifica el cumplimiento. No introduzcas carrito, checkout, cuentas de
cliente ni almacenamiento de datos del visitante salvo que se pida explícitamente.

---

## 2. Los tres repositorios

| Repo | Qué es | Stack | Puerto dev |
|---|---|---|---|
| `shop-backend-service` | Monolito Spring Boot. Única fuente de datos. Expone API pública de lectura y API de administración. Sirve las imágenes. | Java 25 + Spring Boot 4.1 + PostgreSQL 17 | `8080` |
| `shop-dashboard-web` | Sitio público. Renderizado en servidor (SSR). | Angular 22 + `@angular/ssr` | `4200` (dev) / `4000` (SSR) |
| `shop-backoffice-web` | Panel de administración. SPA pura, sin SSR. | Angular 22 | `4300` |

```
                     ┌─────────────────────────────┐
   visitante  ─────► │  shop-dashboard-web (SSR)   │ ──┐
   (sin login)       └─────────────────────────────┘   │  API pública
                                                        │  sin auth, rate-limited
                     ┌─────────────────────────────┐   │  solo lectura
   administrador ──► │  shop-backoffice-web        │ ──┤
   (con login)       └─────────────────────────────┘   │  API admin
                                                        │  JWT + permisos
                                                        ▼
                                      ┌─────────────────────────────┐
                                      │   shop-backend-service      │
                                      │   Spring Boot monolito      │
                                      └───────────┬─────────────────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    ▼                           ▼
                            ┌───────────────┐         ┌──────────────────┐
                            │ PostgreSQL 17 │         │ Volumen de       │
                            │               │         │ imágenes (disco) │
                            └───────────────┘         └──────────────────┘
```

**Regla de dependencia:** los repos de frontend dependen del backend. El backend
no conoce a los frontends. Nunca metas lógica de negocio en un frontend: el
precio efectivo con descuento, la validez de un descuento y si un producto es
visible son decisiones del backend, y el frontend solo las muestra.

---

## 3. Versiones fijadas

Verificadas en septiembre de 2026. **No las cambies sin avisar**; si alguna no
existe o no compila, detente y repórtalo en lugar de bajar de versión en silencio.

| Componente | Versión | Nota |
|---|---|---|
| Java | **25 (LTS)** | LTS vigente. El siguiente LTS es Java 29 (sept 2027). |
| Spring Boot | **4.1.x** | Requiere Spring Framework 7, Jakarta EE 11, Servlet 6.1. |
| PostgreSQL | **17.x** | |
| Flyway | La que traiga el BOM de Spring Boot 4.1 | |
| Testcontainers | Última estable | |
| Angular | **22.x** | |
| Node | **24.x LTS** | |
| Gestor de dependencias backend | **Gradle (Kotlin DSL)** | Alternativa aceptable: Maven, pero elige uno y sé consistente. |
| Gestor de paquetes frontend | **pnpm** | |

### Trampas de Spring Boot 4.x que debes conocer antes de escribir la primera línea

Spring Boot 4 rompió cosas respecto a 3.x. La mayoría de ejemplos que encontrarás
en internet son de 3.x y **no compilarán**. En concreto:

- `spring-boot-starter-web` se llama ahora **`spring-boot-starter-webmvc`**.
- Los módulos se reorganizaron al patrón `spring-boot-<tecnología>` y los
  paquetes a `org.springframework.boot.<tecnología>`. `@EntityScan` vive ahora
  en `org.springframework.boot.persistence.autoconfigure`.
- **Jackson 3**: el groupId pasó de `com.fasterxml.jackson` a `tools.jackson`.
  `@JsonComponent` → `@JacksonComponent`, `@JsonMixin` → `@JacksonMixin`.
- **Tests**: `@SpringBootTest` ya no provee MockMvc, `TestRestTemplate` ni
  `WebClient` automáticamente — hay que pedirlos explícitamente.
  `@MockBean`/`@SpyBean` fueron reemplazados por `@MockitoBean`/`@MockitoSpyBean`.
- Undertow ya no está soportado. Usa Tomcat (el default).
- Spring Security 7 tiene su propia guía de migración; la configuración por
  lambda-DSL es ahora la única forma.

**Instrucción operativa:** antes de usar una API de Spring que no estés seguro
de que existe en 4.1, consulta la documentación oficial. Si un ejemplo que
recuerdas es de Spring Boot 3, asume que cambió.

### Trampas de Angular 22

- `OnPush` es la estrategia de detección de cambios **por defecto**.
  `ChangeDetectionStrategy.Default` está deprecado a favor de `Eager`.
- `HttpClient` usa `FetchBackend` por defecto; `withFetch()` está deprecado.
  Si necesitas progreso de subida (lo necesitas en el backoffice para imágenes),
  hay que configurar `withXhr()` explícitamente.
- Las APIs `resource`, `rxResource`, `httpResource` y Signal Forms ya son
  estables — úsalas en lugar de patrones antiguos con RxJS manual.
- La hidratación incremental está activa por defecto.
- Nada de NgModules. Componentes standalone siempre.

---

## 4. Modelo de dominio

Nombres de tabla en `snake_case` y plural. Claves primarias `UUID` (v7 si está
disponible, para ordenamiento natural; si no, v4). Todas las tablas llevan
`created_at` y `updated_at` (`TIMESTAMPTZ`).

### 4.1 `categories`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `name` | varchar(120) | obligatorio, único |
| `slug` | varchar(140) | obligatorio, único, generado del nombre, inmutable tras publicar |
| `description` | text | opcional |
| `sort_order` | int | por defecto 0; ordena la lista de filtros |
| `active` | boolean | por defecto true; si es false no aparece en el sitio público |
| `image_id` | UUID FK → `product_images` | opcional, imagen de portada |

Una categoría **no puede borrarse si tiene productos**. El backoffice debe
ofrecer reasignar los productos a otra categoría antes de borrar.

### 4.2 `products`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `sku` | varchar(64) | único, obligatorio, se muestra en el mensaje de WhatsApp |
| `name` | varchar(200) | obligatorio |
| `slug` | varchar(220) | único, obligatorio, generado del nombre **al crear**; **inmutable después**: es la URL pública que se comparte por WhatsApp y tiene que seguir funcionando. Hacerlo editable exigiría además una redirección 301 desde el antiguo (ver `shop-dashboard-web` §9, mejora futura). |
| `short_description` | varchar(300) | opcional; se muestra en la tarjeta del grid |
| `description` | text | opcional; HTML saneado, se muestra en el modal de detalle |
| `usage_instructions` | text | opcional; HTML saneado; si es null el modal no muestra la pestaña |
| `category_id` | UUID FK → `categories` | obligatorio |
| `price` | numeric(12,2) | obligatorio, > 0 |
| `currency` | char(3) | por ahora siempre `USD` |
| `stock` | int | obligatorio, >= 0 |
| `track_stock` | boolean | si es false, `stock` se ignora y nunca se marca agotado |
| `status` | enum | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| `published_at` | timestamptz | se llena al pasar a `PUBLISHED` |
| `featured` | boolean | destacado; puede usarse para ordenar |
| `sort_order` | int | orden manual dentro de la categoría |
| `discount_*` | (ver abajo) | embebido |
| `created_by` / `updated_by` | UUID FK → `app_users` | auditoría |

**Regla central de visibilidad:** un producto aparece en la API pública **solo
si** `status = 'PUBLISHED'` **y** su categoría tiene `active = true`. Esto es lo
que el usuario llamó "darle de alta". Un producto en `DRAFT` es invisible para
el público aunque se conozca su URL: la API pública debe devolver `404`, no `403`
(no filtrar información sobre su existencia).

`ARCHIVED` es un borrado suave para productos descontinuados que se quieren
conservar por historial. También invisible al público.

### 4.3 Descuento (embebido en `products`)

| Campo | Tipo | Reglas |
|---|---|---|
| `discount_type` | enum `PERCENTAGE` \| `FIXED_AMOUNT` | null si no hay descuento |
| `discount_value` | numeric(12,2) | % entre 0.01 y 90, o monto > 0 y < `price` |
| `discount_starts_at` | timestamptz | opcional; null = ya vigente |
| `discount_ends_at` | timestamptz | opcional; null = sin vencimiento |

Se embebe en `products` en vez de ir en su propia tabla porque hay a lo sumo un
descuento activo por producto y no se necesita historial. Si más adelante hace
falta historial de precios, se extrae a una tabla `product_price_history`.

**Precio efectivo** — lo calcula **el backend**, nunca el frontend:

```
si no hay descuento configurado         → effective_price = price
si hoy < discount_starts_at             → effective_price = price   (aún no vigente)
si hoy > discount_ends_at               → effective_price = price   (ya venció)
si PERCENTAGE                           → price * (1 - value/100)
si FIXED_AMOUNT                         → price - value
redondeo: 2 decimales, HALF_UP
piso: nunca menor que 0.01
```

La API pública devuelve siempre `price` (precio de lista), `effectivePrice`,
`onSale` (booleano) y `discountPercentage` (entero, para el badge "-20%").
El frontend solo pinta lo que recibe.

### 4.4 `product_images`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID FK → `products` | `ON DELETE CASCADE` |
| `storage_key` | varchar(255) | ruta relativa dentro del volumen, generada por el sistema |
| `original_filename` | varchar(255) | solo informativo; **nunca se usa para construir rutas** |
| `alt_text` | varchar(200) | accesibilidad y SEO |
| `sort_order` | int | orden en el carrusel |
| `is_primary` | boolean | exactamente una por producto; es la que sale en el grid |
| `status` | enum `PROCESSING` \| `READY` \| `FAILED` | |
| `renditions` | jsonb | dimensiones y bytes reales de cada versión generada |
| `content_hash` | char(64) | SHA-256 del original; permite cache inmutable y deduplicar |

**Versiones generadas** por cada imagen subida:

| Nombre | Ancho máx. | Uso |
|---|---|---|
| `thumb` | 200 px | miniaturas en el backoffice |
| `card` | 600 px | tarjeta del grid en escritorio (3 columnas ≈ 400 px CSS) |
| `card2x` | 1200 px | la misma tarjeta en pantallas de alta densidad y en móvil a 1 columna |
| `detail` | 1400 px | carrusel del modal de detalle |

**Por qué existe `card2x`:** en un móvil de 390 px CSS con una columna y
densidad 3x, la tarjeta necesita ~1170 px reales. Con solo `card` (600 px) la
imagen se ve borrosa; sin él, el navegador salta a `detail` (1400 px) y descarga
bastante más de lo necesario, justo en la conexión más lenta y penalizando el
LCP móvil, que es la métrica que más importa aquí. Un escalón intermedio lo
resuelve. El frontend declara ambos en el mismo `srcset` con sus descriptores
`w` y deja que el navegador elija.

Cada versión se genera en **WebP** (principal) y **JPEG** (respaldo). La relación
de aspecto original se conserva; no se recorta. El frontend usa `<picture>` con
`srcset` para que el navegador elija.

Ruta en disco, determinista:

```
{app.media.base-path}/products/{product_id}/{image_id}/{rendition}.{ext}
```

Ejemplo: `/data/media/products/0192.../01930.../card.webp`

### 4.5 `app_users`, `roles`, `permissions`

Usuarios **solo del backoffice**. El público no tiene cuentas.

`app_users`: `id`, `email` (único, ciudadano de primera para el login),
`password_hash`, `full_name`, `enabled`, `last_login_at`,
`failed_login_attempts`, `locked_until`, `must_change_password`.

`roles`: `id`, `name`, `description`, `system` (los roles de sistema no se
pueden borrar ni renombrar).

`permissions`: catálogo fijo de cadenas. Las relaciones son
`user_roles` (N:M) y `role_permissions` (N:M).

Permisos disponibles:

```
PRODUCT_READ      PRODUCT_WRITE     PRODUCT_PUBLISH    PRODUCT_DELETE
CATEGORY_READ     CATEGORY_WRITE    CATEGORY_DELETE
MEDIA_UPLOAD      MEDIA_DELETE
SETTINGS_READ     SETTINGS_WRITE
USER_READ         USER_WRITE        USER_DELETE
ROLE_READ         ROLE_WRITE
ANALYTICS_READ
AUDIT_READ
```

Roles precargados por migración:

- **ADMIN** — todos los permisos.
- **EDITOR** — productos, categorías y medios completos, incluido publicar.
  Sin acceso a usuarios, roles ni settings.
- **VIEWER** — solo los `*_READ` y `ANALYTICS_READ`.

Reglas duras que hay que probar con tests:

1. Siempre debe existir **al menos un usuario habilitado con rol ADMIN**.
   El sistema rechaza la operación que dejaría cero.
2. Un usuario **no puede eliminarse ni deshabilitarse a sí mismo**.
3. Un usuario **no puede otorgarse un permiso que él mismo no tiene**.
4. El usuario administrador inicial se crea por migración con contraseña leída
   de variable de entorno y `must_change_password = true`. Nunca una contraseña
   fija en el código o en el repositorio.

### 4.6 `settings`

Clave-valor tipado, editable desde el backoffice. Cada clave declara si es
**pública** (la expone la API sin auth) o **privada**.

| Clave | Tipo | Pública | Descripción |
|---|---|---|---|
| `store.name` | string | sí | Nombre de la tienda |
| `store.tagline` | string | sí | Frase corta para la portada y meta description |
| `store.logo_image_id` | uuid | sí | |
| `whatsapp.phone_number` | string | sí | Formato E.164 sin `+` (ej. `50370000000`) |
| `whatsapp.template_single` | text | sí | Plantilla para un producto |
| `whatsapp.template_multi_header` | text | sí | Encabezado del mensaje multi-producto |
| `whatsapp.template_multi_item` | text | sí | Se repite por cada producto seleccionado |
| `whatsapp.template_multi_footer` | text | sí | Cierre con totales |
| `catalog.page_size` | int | sí | Productos por lote en el scroll infinito (por defecto 12) |
| `catalog.hide_out_of_stock` | bool | sí | true = ocultar agotados; false = mostrarlos marcados |
| `catalog.max_selection` | int | sí | Tope de productos seleccionables a la vez (por defecto 20) |
| `seo.default_og_image_id` | uuid | sí | |
| `analytics.enabled` | bool | no | |

El endpoint público de settings devuelve **solo las claves marcadas como
públicas**, mediante una lista blanca explícita en el código. Nunca serialices
la tabla completa.

### 4.7 `analytics_events`

| Campo | Tipo |
|---|---|
| `id` | UUID PK |
| `type` | enum `PRODUCT_VIEW` \| `WHATSAPP_CLICK` \| `SEARCH` \| `CATEGORY_VIEW` |
| `product_id` | UUID FK, nullable |
| `payload` | jsonb (término buscado, cantidad de productos del clic, etc.) |
| `session_id` | varchar(64) — identificador anónimo del navegador, sin PII |
| `occurred_at` | timestamptz |
| `ip_hash` | char(64) — SHA-256 de IP + sal del servidor, **no la IP** |
| `user_agent` | varchar(255) |

Se agregan a diario en `analytics_daily` (fecha, tipo, product_id, conteo) con
una tarea programada; el panel del backoffice consulta la tabla agregada, no la
de eventos crudos. Los eventos crudos se purgan a los 90 días.

**Privacidad:** no se guardan IPs en claro, ni cookies de seguimiento, ni datos
del visitante. El `session_id` lo genera el navegador y vive en `sessionStorage`.

### 4.8 `audit_log`

Toda escritura desde el backoffice deja registro: `user_id`, `action`,
`entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `at`, `ip_hash`.
Los campos sensibles (`password_hash`) se excluyen del volcado.

---

## 5. Contrato de API

Base: `https://api.midominio.com`. Versión en la ruta.

### 5.1 API pública — `/api/public/v1/**`

Sin autenticación. **Solo lectura** (única excepción: el `POST` de eventos de
analítica). Con límite de peticiones.

#### `GET /api/public/v1/products`

Parámetros:

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| `page` | int >= 0 | 0 | |
| `size` | int 1..48 | `catalog.page_size` | valores fuera de rango se recortan, no dan error |
| `sort` | `name,asc` \| `name,desc` \| `price,asc` \| `price,desc` \| `newest` \| `relevance` | `featured` | lista blanca estricta |
| `q` | string (máx. 100) | — | busca en nombre, sku y descripción corta |
| `category` | slug, repetible | — | `?category=aceites&category=cremas` = OR entre ellas |
| `minPrice` / `maxPrice` | decimal | — | se aplican sobre el **precio efectivo** |
| `onSale` | bool | — | solo productos con descuento vigente |
| `inStock` | bool | — | |
| `ids` | UUID, repetible (máx. 50) | — | Devuelve solo esos productos e **ignora los demás filtros**. Aplica las mismas reglas de visibilidad: un producto no publicado simplemente no aparece, sin error. El orden de la respuesta no sigue al de los `ids`. Lo usa `shop-dashboard-web` para restaurar la selección del visitante en una sola petición. |

Respuesta:

```json
{
  "content": [ /* ProductCard */ ],
  "page": 0,
  "size": 12,
  "totalElements": 134,
  "totalPages": 12,
  "hasNext": true
}
```

`ProductCard`:

```json
{
  "id": "0192...",
  "sku": "ACE-001",
  "name": "Aceite esencial de lavanda 30ml",
  "slug": "aceite-esencial-de-lavanda-30ml",
  "shortDescription": "Relajante, 100% puro",
  "price": 25.00,
  "effectivePrice": 20.00,
  "onSale": true,
  "discountPercentage": 20,
  "currency": "USD",
  "inStock": true,
  "category": { "slug": "aceites", "name": "Aceites" },
  "primaryImage": {
    "altText": "Frasco de aceite de lavanda",
    "thumb":  { "webp": "/media/.../thumb.webp",  "jpeg": "/media/.../thumb.jpg",  "width": 200,  "height": 200 },
    "card":   { "webp": "/media/.../card.webp",   "jpeg": "/media/.../card.jpg",   "width": 600,  "height": 600 },
    "card2x": { "webp": "/media/.../card2x.webp", "jpeg": "/media/.../card2x.jpg", "width": 1200, "height": 1200 }
  }
}
```

> **Ordenamiento estable:** cualquier `sort` debe llevar `id` como criterio de
> desempate final. Sin eso, la paginación por offset duplica y salta elementos
> cuando hay valores repetidos — y con scroll infinito eso se ve como productos
> que aparecen dos veces. Es un fallo real y debe tener un test.

#### `GET /api/public/v1/products/{slug}`

Devuelve `ProductDetail`: todo lo de `ProductCard` más `description`,
`usageInstructions` y el arreglo completo de imágenes con la versión `detail`.
`404` si no existe o no está publicado.

#### `GET /api/public/v1/categories`

Categorías activas que tengan al menos un producto publicado, con el conteo de
productos de cada una (para mostrar "Aceites (24)" en el filtro).

#### `GET /api/public/v1/settings`

Lista blanca de settings públicos. Es lo que alimenta la plantilla de WhatsApp
del sitio. Cacheable 5 minutos.

#### `POST /api/public/v1/events`

Registra un evento de analítica. Cuerpo: `{ type, productId?, payload?, sessionId }`.
Responde `202 Accepted` con cuerpo vacío. Nunca falla la experiencia del usuario:
si el registro falla, se ignora silenciosamente del lado del cliente.

#### `GET /media/**`

Sirve las imágenes. `Cache-Control: public, max-age=31536000, immutable`
(la ruta incluye el id de la imagen, así que nunca cambia el contenido de una
ruta dada). Solo `GET` y `HEAD`.

### 5.2 API de autenticación — `/api/auth/**`

| Endpoint | Qué hace |
|---|---|
| `POST /api/auth/login` | `{ email, password }` → token de acceso en el cuerpo + cookie de refresco |
| `POST /api/auth/refresh` | lee la cookie, rota el token de refresco, devuelve nuevo token de acceso |
| `POST /api/auth/logout` | revoca el token de refresco y limpia la cookie |
| `GET  /api/auth/me` | usuario actual con sus permisos efectivos |
| `POST /api/auth/change-password` | requiere la contraseña actual |

**Esquema de sesión (decidido, no lo cambies sin motivo):**

- **Token de acceso**: JWT firmado (HS256 con secreto de al menos 32 bytes, o
  RS256 si se quiere separar firma y verificación). Vida: **15 minutos**.
  Va en `Authorization: Bearer`. El frontend lo guarda **en memoria**, nunca en
  `localStorage`.
- **Token de refresco**: opaco (UUID aleatorio), guardado **hasheado** en la
  tabla `refresh_tokens`. Vida: **7 días**. Viaja en cookie
  `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`.
- **Rotación**: cada `refresh` invalida el anterior y emite uno nuevo. Si llega
  un token de refresco ya usado, se revoca **toda la familia** de tokens de ese
  usuario y se registra en auditoría — eso indica robo de token.

Por qué así: un JWT en `localStorage` es robable con cualquier XSS; una cookie
`HttpOnly` no lo es. El token de acceso corto en memoria limita el daño si
algo se filtra, y la rotación detecta reutilización.

### 5.3 API de administración — `/api/admin/v1/**`

Requiere `Authorization: Bearer` válido **y** el permiso correspondiente.

```
GET    /products                  PRODUCT_READ    (filtros y paginación propios, incluye DRAFT)
POST   /products                  PRODUCT_WRITE
GET    /products/{id}             PRODUCT_READ
PUT    /products/{id}             PRODUCT_WRITE
DELETE /products/{id}             PRODUCT_DELETE  (borra imágenes de disco también)
POST   /products/{id}/publish     PRODUCT_PUBLISH
POST   /products/{id}/unpublish   PRODUCT_PUBLISH
POST   /products/{id}/archive     PRODUCT_WRITE
PUT    /products/{id}/discount    PRODUCT_WRITE
DELETE /products/{id}/discount    PRODUCT_WRITE

POST   /products/{id}/images      MEDIA_UPLOAD    (multipart; devuelve 202 + id, procesa en background)
GET    /products/{id}/images      PRODUCT_READ
PUT    /products/{id}/images/order MEDIA_UPLOAD   (reordenar)
PUT    /images/{imageId}          MEDIA_UPLOAD    (alt text, marcar como principal)
DELETE /images/{imageId}          MEDIA_DELETE

GET|POST|PUT|DELETE /categories   CATEGORY_*
GET|PUT             /settings     SETTINGS_*
POST   /settings/whatsapp/preview SETTINGS_READ   (renderiza la plantilla con datos de ejemplo)

GET|POST|PUT|DELETE /users        USER_*
POST   /users/{id}/reset-password USER_WRITE
GET|POST|PUT        /roles        ROLE_*
GET    /permissions               ROLE_READ

GET    /analytics/summary         ANALYTICS_READ
GET    /analytics/top-products    ANALYTICS_READ
GET    /audit                     AUDIT_READ
```

### 5.4 Formato de errores

**Siempre** RFC 9457 `application/problem+json`. Nunca una traza de pila.

```json
{
  "type": "https://api.midominio.com/errors/validation",
  "title": "Datos inválidos",
  "status": 400,
  "detail": "La solicitud tiene 2 campos inválidos",
  "instance": "/api/admin/v1/products",
  "traceId": "a1b2c3d4",
  "errors": [
    { "field": "price", "message": "debe ser mayor que 0" },
    { "field": "sku",   "message": "ya existe un producto con este SKU" }
  ]
}
```

| Código | Cuándo |
|---|---|
| `400` | validación fallida |
| `401` | sin token o token vencido |
| `403` | autenticado pero sin el permiso |
| `404` | no existe, o existe pero no es visible para quien pregunta |
| `409` | conflicto de estado (SKU duplicado, borrar categoría con productos) |
| `413` | archivo demasiado grande |
| `415` | tipo de archivo no admitido |
| `422` | semánticamente inválido (descuento mayor que el precio) |
| `429` | límite de peticiones excedido — incluye `Retry-After` |
| `500` | error inesperado — cuerpo genérico + `traceId` que sí aparece en los logs |

`traceId` es la pieza que permite que alguien reporte un error y tú lo encuentres
en los logs sin exponer nada al cliente.

---

## 6. Plantilla del mensaje de WhatsApp

El administrador edita la plantilla desde el backoffice. Se renderiza **en el
navegador del visitante** (el frontend ya tiene todos los datos), pero la
plantilla y el número vienen del backend.

### Marcadores disponibles

**Por producto** — válidos en `template_single` y en `template_multi_item`:

| Marcador | Ejemplo |
|---|---|
| `{{producto}}` | Aceite esencial de lavanda 30ml |
| `{{precio}}` | $20.00 (precio efectivo, ya con descuento) |
| `{{cantidad}}` | 2 |
| `{{url}}` | https://tienda.com/p/aceite-esencial-de-lavanda-30ml |
| `{{sku}}` | ACE-001 |
| `{{precio_lista}}` | $25.00 (precio antes del descuento) |
| `{{descuento}}` | 20% |
| `{{subtotal}}` | $40.00 (precio efectivo × cantidad) |
| `{{moneda}}` | USD |

Los cuatro que se pidieron son `{{producto}}`, `{{precio}}`, `{{cantidad}}` y
`{{url}}`. Los otros cinco se añaden porque en la práctica hacen falta: sin
`{{sku}}` el vendedor no sabe cuál referencia es cuando hay nombres parecidos, y
sin `{{subtotal}}` el cliente tiene que multiplicar a mano.

**Globales** — válidos en cualquier plantilla:

| Marcador | Ejemplo |
|---|---|
| `{{tienda}}` | Mi Tienda |
| `{{fecha}}` | 12/09/2026 |
| `{{total}}` | $65.00 (solo en el pie del mensaje multi-producto) |
| `{{items}}` | 3 (cantidad de líneas distintas) |
| `{{unidades}}` | 5 (suma de cantidades) |

### Valores por defecto que van en la migración inicial

`whatsapp.template_single`:

```
¡Hola! Me interesa este producto de {{tienda}}:

*{{producto}}*
SKU: {{sku}}
Precio: {{precio}}
Cantidad: {{cantidad}}
Total: {{subtotal}}

{{url}}
```

`whatsapp.template_multi_header`:

```
¡Hola! Me interesan estos productos de {{tienda}}:
```

`whatsapp.template_multi_item`:

```
• *{{producto}}* (x{{cantidad}}) — {{subtotal}}
  {{url}}
```

`whatsapp.template_multi_footer`:

```

*Total: {{total}}* ({{unidades}} unidades)
```

### Reglas de renderizado

1. Un marcador desconocido se deja **tal cual** en el texto, no revienta.
2. Un marcador "por producto" usado en una plantilla global se reemplaza por
   cadena vacía.
3. El resultado se codifica con `encodeURIComponent` y se arma la URL:
   `https://wa.me/{numero}?text={mensajeCodificado}`
4. **Límite de longitud**: WhatsApp corta mensajes muy largos. Si el mensaje
   renderizado supera **1500 caracteres**, se trunca la lista de ítems y se
   añade `… y N productos más`. Hay que probar este caso.
5. La validación de la plantilla al guardarla ocurre **en el backend**: se
   verifica que los marcadores usados existan y que el resultado con datos de
   ejemplo no esté vacío. El endpoint `/settings/whatsapp/preview` devuelve el
   mensaje renderizado con datos falsos para que el administrador lo vea antes
   de guardar.

### Dos implementaciones, un solo resultado

El renderizado existe en dos sitios: en el backend (lo usa el preview del
backoffice) y en el navegador del visitante (lo usa el sitio público). **Tienen
que producir exactamente el mismo texto**, o el administrador aprobará una cosa
y el cliente recibirá otra.

Cómo se garantiza: el backend genera un archivo de casos de referencia,
`whatsapp-golden.json`, con pares de entrada y salida esperada producidos por su
propia implementación, y lo publica como artefacto de su build. `shop-dashboard-web`
commitea ese archivo y tiene un test que lo recorre caso por caso. Si alguien
cambia una de las dos implementaciones, ese test se pone rojo.

Así el sitio público nunca necesita llamar a `/api/admin/**`, que es una API a la
que no tiene ni debe tener acceso.

### Formato del número

`whatsapp.phone_number` se guarda en E.164 **sin** el `+` y sin espacios ni
guiones, porque así lo espera `wa.me`. El backoffice valida el formato y muestra
el número formateado para lectura humana.

---

## 7. Seguridad — decisiones transversales

### Lo que aplica a todo el backend

- **Nada de concatenar SQL.** Todo por Spring Data JPA o consultas con
  parámetros vinculados. Si hace falta SQL nativo, parámetros nombrados
  obligatorios. Un test de ArchUnit debe prohibir la concatenación de cadenas
  dentro de `@Query`.
- **Nunca vincular entidades JPA a cuerpos de petición.** Siempre DTOs de
  entrada con `@Valid`. Esto evita asignación masiva (que alguien mande
  `"status": "PUBLISHED"` en un endpoint que no debería permitirlo).
- **Saneado de HTML**: `description` y `usage_instructions` aceptan HTML
  limitado (negritas, listas, párrafos, enlaces). Se sanean **al guardar** con
  una lista blanca (OWASP Java HTML Sanitizer o equivalente) y se vuelven a
  tratar con cuidado al renderizar en Angular. Saneado en un solo lado no basta.
- **Validación en el borde**: toda entrada con Bean Validation. Longitudes
  máximas en todos los campos de texto. Sin excepción: un campo de texto sin
  longitud máxima es una vía de denegación de servicio.
- **Cabeceras de seguridad** en todas las respuestas: `Content-Security-Policy`,
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  restrictiva.
- **CORS** con lista explícita de orígenes por entorno. Nunca `*` junto con
  credenciales.
- **Contraseñas** con BCrypt de coste 12 (o Argon2id si está disponible).
  Mínimo 12 caracteres. Bloqueo tras 5 intentos fallidos durante 15 minutos.
- **Secretos** solo por variables de entorno. Ningún secreto en el repositorio,
  ni siquiera en `application-dev.yml`. Hay un `.env.example` con nombres y
  valores falsos.
- **Dependencias**: OWASP Dependency-Check en el build y Dependabot/Renovate
  en el repo. Una vulnerabilidad crítica rompe la compilación.

### Límite de peticiones

Solo la API pública lo necesita (el backoffice está detrás de login). Bucket4j
con almacenamiento en memoria (Caffeine) — es un monolito de una sola instancia,
no hace falta Redis. Si algún día se escala horizontalmente, se cambia el
backend de Bucket4j y nada más.

| Ruta | Límite por IP |
|---|---|
| `GET /api/public/v1/products` (listado) | 120 / minuto |
| Listado **con `q`** (búsqueda) | 30 / minuto |
| `GET /api/public/v1/products/{slug}` | 120 / minuto |
| `GET /api/public/v1/categories` y `/settings` | 60 / minuto |
| `POST /api/public/v1/events` | 60 / minuto |
| `POST /api/auth/login` | 10 / minuto **por IP y por email** |

Al exceder: `429` con `Retry-After` y cabeceras `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, `X-RateLimit-Reset`.

**IP real detrás del proxy:** el contenedor está detrás de un proxy inverso, así
que `request.getRemoteAddr()` devolverá la IP del proxy y **todo el mundo
compartiría el mismo cubo**. Hay que leer `X-Forwarded-For`, pero **solo si la
petición viene de la IP del proxy conocida** (configurable en
`app.security.trusted-proxies`); si no, cualquiera falsifica la cabecera y evade
el límite. Este es el error más común al implementar rate limiting y debe tener
un test.

**SSR cuenta como un cliente:** las peticiones que hace el servidor de Angular
al renderizar vienen todas de la misma IP. Hay que excluir esa IP del límite o
darle un cubo aparte mucho más amplio (`app.security.internal-clients`). Si no,
el sitio público se auto-bloquea en cuanto haya algo de tráfico. También debe
tener un test.

**Ambas listas aceptan IP sueltas y rangos CIDR**, mezclados:
`127.0.0.1, 10.0.0.5, 172.16.0.0/12`. El rango no es un lujo: en Docker las IP
de los contenedores las reparte el demonio y cambian en cada arranque, así que
una IP fija en la configuración se queda obsoleta sola. Un valor vacío significa
lista vacía —no "todos"—, que es el valor correcto en local, donde no hay proxy
inverso delante. Una entrada mal formada debe **impedir el arranque** con un
mensaje que diga cuál es, no ignorarse en silencio: ignorarla convierte
`trusted-proxies` en "no confío en nadie" y el límite pasa a contar a todos los
visitantes en el mismo cubo.

### Subida de imágenes — el punto más delicado

Este es el único lugar donde un extraño... bueno, no: donde un usuario
autenticado sube bytes arbitrarios al servidor. Las reglas:

1. **Tamaño máximo 10 MB**, configurable. Rechazo con `413` antes de leer el
   archivo entero a memoria.
2. **Tipo verificado por contenido, no por la cabecera ni la extensión.** Leer
   los primeros bytes y detectar el tipo real (Apache Tika). Solo se aceptan
   JPEG, PNG, WebP y AVIF.
3. **Re-codificar siempre.** Nunca se guarda el archivo original tal cual: se
   decodifica a mapa de bits y se vuelve a codificar. Esto elimina metadatos
   EXIF (que pueden llevar la ubicación GPS de donde se tomó la foto) y destruye
   cualquier carga útil escondida en el archivo. Es la defensa que de verdad
   funciona contra "imágenes" maliciosas.
4. **Límite de dimensiones**: rechazar imágenes de más de 12000 px por lado o
   más de 100 megapíxeles. Una imagen de 50000×50000 px pesa poco comprimida
   pero revienta la memoria al descomprimirla (bomba de descompresión).
5. **Nombre de archivo generado por el sistema** a partir de UUIDs. El nombre
   original se guarda solo como dato informativo. Nunca se usa para construir
   una ruta — ahí es donde entra el recorrido de directorios (`../../etc/passwd`).
6. **Ruta canónica verificada**: tras construir la ruta de destino, comprobar
   que realmente queda dentro de `app.media.base-path`.
7. **Se sirve con `Content-Type` fijo** según la versión generada y
   `X-Content-Type-Options: nosniff`, para que el navegador no interprete nada
   como HTML.
8. **Procesamiento asíncrono**: la subida responde `202` con el id de la imagen
   en estado `PROCESSING`; un trabajo en segundo plano genera las versiones y
   pasa a `READY` o `FAILED`. El backoffice consulta el estado. Así una imagen
   grande no bloquea la petición.

Herramienta de redimensionado: se puede hacer en Java puro (Thumbnailator +
TwelveMonkeys ImageIO para decodificar formatos modernos, y un codificador WebP)
o invocando `libvips`/ImageMagick instalado en la imagen Docker. **Elige una,
verifica que las dependencias existen y compilan, y déjalo documentado.** Si la
vía elegida no funciona, cambia a la otra y anótalo — no dejes el código a medias.

### Almacenamiento de imágenes en Docker

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      APP_MEDIA_BASE_PATH: /data/media
    volumes:
      - /srv/shop/media:/data/media
```

La propiedad es `app.media.base-path`, leída de `APP_MEDIA_BASE_PATH`.
El contenedor corre como usuario no-root y ese usuario debe tener permisos de
escritura en el volumen. La aplicación debe **fallar al arrancar** con un
mensaje claro si la ruta no existe o no es escribible — mucho mejor que
descubrirlo cuando alguien sube la primera foto.

---

## 8. Convenciones compartidas

- **Idioma del código**: nombres de clases, variables, ramas y mensajes de
  commit en **inglés**. Comentarios y documentación en **español**. Los textos
  visibles para el usuario van siempre en archivos de traducción, nunca
  incrustados en el código.
- **Fechas y horas**: el backend trabaja en **UTC** (`TIMESTAMPTZ`, `Instant`).
  La conversión a `America/El_Salvador` ocurre solo al mostrar.
- **Dinero**: `BigDecimal` en Java, `numeric(12,2)` en PostgreSQL.
  **Nunca `double` o `float` para precios.** En JSON viaja como número con dos
  decimales.
- **Identificadores**: UUID en las APIs. Los ids numéricos autoincrementales
  filtran cuántos productos tienes y permiten recorrer el catálogo entero.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- **Ramas**: `main` protegida. Trabajo en `feat/…`, `fix/…`.
- **Un cambio, un commit.** Nada de commits que tocan tres cosas no relacionadas.

### Puntos de corte (breakpoints) — los mismos en los dos frontends

Definidos una sola vez, como variables CSS, y usados por igual en `shop-dashboard-web` y
en `shop-backoffice-web`. Que los dos proyectos usen la misma escala evita que
acabes con dos sistemas distintos que nadie recuerda.

| Nombre | Desde | Dispositivo típico |
|---|---|---|
| `xs` | 0 px | móvil pequeño (iPhone SE, 320–374 px) |
| `sm` | 480 px | móvil grande |
| `md` | 768 px | tableta vertical |
| `lg` | 1024 px | tableta horizontal / portátil pequeño |
| `xl` | 1280 px | escritorio |
| `2xl` | 1536 px | pantalla grande |

Reglas comunes a ambos frontends:

1. **Móvil primero.** Los estilos base son los del móvil; los `@media` solo
   añaden a partir de `min-width`. Nada de `max-width` como regla general: lleva
   a cascadas que se pisan entre sí.
2. **Nunca se maqueta por dispositivo, se maqueta por espacio disponible.**
   Usa `clamp()`, `minmax()` y unidades relativas antes que un `@media` nuevo.
   Cuando un componente deba adaptarse a su contenedor y no a la ventana
   (una tarjeta que vive tanto en una columna estrecha como en una ancha),
   usa consultas de contenedor (`@container`).
3. **Áreas táctiles de 44×44 px como mínimo**, con al menos 8 px de separación
   entre controles adyacentes. Un icono de 16 px con área táctil de 16 px es
   inusable con el pulgar, y esto se olvida siempre en las tablas.
4. **Ancho mínimo soportado: 320 px.** Por debajo de eso no se garantiza nada.
   A 320 px **no puede haber scroll horizontal** en ninguna pantalla.
5. **Nada de tamaños de fuente fijos en px para el texto de lectura.** `rem`,
   respetando el tamaño base que el usuario tenga configurado en su navegador.
   Debe seguir siendo usable con el zoom del navegador al 200 %.
6. **Zonas seguras** (`env(safe-area-inset-*)`) en los elementos fijos a los
   bordes, o la barra inferior queda debajo del indicador de inicio del iPhone.
7. **Orientación horizontal en móvil**: la altura útil baja a ~360 px. Los
   diálogos y paneles deben poder desplazarse; nada con `height: 100vh` fijo.
8. **`100vh` no es la altura visible en móvil.** La barra de direcciones del
   navegador la cambia al desplazarse. Usa `100dvh` donde importe.

---

## 9. Decisiones ya tomadas (y por qué)

Estas están cerradas. Si crees que alguna está mal, **dilo antes de implementar**,
no la cambies por tu cuenta.

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Monolito modular | Microservicios | Un catálogo con un backoffice no justifica la complejidad operativa. Los paquetes por dominio dejan la puerta abierta a partirlo si algún día hace falta. |
| Tres repos | Monorepo | Elección explícita del usuario. Requiere disciplina extra en el contrato de API: por eso se genera el cliente TypeScript desde OpenAPI. |
| Imágenes en disco con volumen | S3/MinIO | Despliegue en laboratorio casero, sin necesidad de almacenamiento distribuido. La capa de almacenamiento queda tras una interfaz `MediaStorage` para poder cambiarla sin tocar el resto. |
| Sin carrito ni pagos | Comercio electrónico completo | El cierre de venta es por WhatsApp. Meter pagos cambiaría el proyecto por completo. |
| Paginación por offset | Cursor/keyset | Los filtros y el ordenamiento por precio/nombre complican el keyset, y el catálogo es de cientos, no de millones. Con desempate por `id` el offset es estable. Anotado como deuda técnica si el catálogo crece mucho. |
| Descuento embebido | Tabla de promociones | Un descuento por producto, sin historial. Se extrae si hace falta. |
| Sin variantes | Variantes con SKU propio | Decisión explícita del usuario. El modelo deja `sku` en el producto, así que añadir variantes después es una tabla nueva, no una reescritura. |
| Un solo número de WhatsApp | Varios números | Decisión explícita del usuario. Está en `settings`, así que pasar a varios es cambiar la clave por una tabla. |
| Español con i18n preparado | Solo español, sin i18n | Los textos salen a archivos de traducción desde el día uno. Añadir inglés después es traducir, no refactorizar. Los **nombres y descripciones de productos no son traducibles** por ahora — eso sí requeriría cambiar el modelo. |

---

## 10. Qué NO hacer

- No introducir carrito, checkout, pagos ni cuentas de cliente.
- No guardar datos personales de visitantes. Ni correos, ni teléfonos, ni IPs en claro.
- No poner lógica de precios o de visibilidad en el frontend.
- No usar `localStorage` para tokens.
- No confiar en la extensión o el `Content-Type` de un archivo subido.
- No devolver trazas de pila ni mensajes de error de base de datos al cliente.
- No commitear secretos, ni siquiera de desarrollo.
- No añadir dependencias sin justificarlas en el commit.
- No marcar una tarea como terminada con tests en rojo o sin tests.
