# shop-dashboard-web

Sitio público del catálogo (Angular 22, SSR). Compartible por WhatsApp: al
pegar un enlace `/p/:slug` debe salir la foto y el título del producto.

## Requisitos

- Node 24 (`.node-version`) y pnpm (`packageManager` en `package.json`).
- Docker y Docker Compose, para levantar el backend.
- El repositorio `shop-backend-service` como carpeta hermana (o en cualquier
  ruta): este sitio no tiene datos propios, todo viene de su API.

## Desarrollo

```bash
pnpm install

# En otra terminal, desde shop-backend-service:
#   docker compose up -d
# GET http://localhost:8080/actuator/health debe responder UP.

pnpm start
```

Abre `http://localhost:4200`. `proxy.conf.json` redirige `/api/**` y
`/media/**` al backend en `localhost:8080`, así que no hace falta configurar
`API_BASE_URL` en desarrollo.

## Pruebas

```bash
pnpm lint
pnpm test              # unitarias y de componentes (Vitest + Angular Testing Library)
pnpm e2e                # Playwright — necesita el backend real levantado (arriba)
```

`pnpm e2e` arranca `pnpm start` automáticamente (ver `playwright.config.ts`)
y corre contra `http://localhost:4200`. Sin el backend arriba, los casos que
dependen de catálogo con productos fallan por falta de datos, no por un
error de este repo.

Si el backend tiene el catálogo vacío (recién levantado con
`docker compose up`), siémbralo una vez con
`scripts/seed-e2e-catalog.mjs` (crea las categorías "Aceites"/"Cremas" y 5
productos publicados, incluidos los que los specs de WhatsApp necesitan por
nombre exacto). Es idempotente: correrlo de nuevo no duplica nada.

```bash
ADMIN_PASSWORD=<el ADMIN_INITIAL_PASSWORD del .env del backend> pnpm e2e:seed
```

Para ver el sitio con un catálogo más realista (categorías "Cabello" y "Uñas",
6 productos con foto de relleno y dos con descuento) hay un segundo script,
también idempotente y que no toca las categorías de los e2e:

```bash
ADMIN_PASSWORD=<el ADMIN_INITIAL_PASSWORD del .env del backend> pnpm seed:demo
```

Para medir Lighthouse hace falta el build de producción, no el servidor de
desarrollo:

```bash
pnpm build
pnpm serve:ssr:shop-dashboard-web   # sirve dist/ en el puerto 4000
pnpm lighthouse                     # y/o pnpm lighthouse:product
```

## Build de producción

```bash
pnpm build
```

Genera `dist/shop-dashboard-web/browser` (estático) y `/server` (Node/SSR).

## Variables de entorno

Las lee `src/server.ts` en tiempo de ejecución (no en build):

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PORT` | `4000` | Puerto en el que escucha el servidor Express/SSR. |
| `API_BASE_URL` | `http://localhost:8080` | Base de la API del backend. **Absoluta siempre**, también en producción — el servidor SSR la usa para renderizar. |
| `SITE_URL` | `http://localhost:4200` | Origen público del sitio, usado para `og:url`, `og:image`, `canonical` y el sitemap. Debe ser la URL real con la que se comparte el sitio. |

## Despliegue con Docker

`Dockerfile` es multi-etapa: instala dependencias, hace el build de
producción y copia solo `dist/` + las dependencias de producción (`express`,
`compression`, `@angular/ssr` y afines) a una imagen final `node:24-slim`
que corre como el usuario no root `node` (uid 1000, ya incluido en la
imagen base). Trae `HEALTHCHECK` contra `GET /` usando el `fetch` global de
Node, sin depender de `curl`/`wget`.

```bash
docker build -t shop-dashboard-web .

docker run --rm -p 4000:4000 \
  -e API_BASE_URL=http://localhost:8080 \
  -e SITE_URL=http://localhost:4000 \
  shop-dashboard-web
```

`curl http://localhost:4000/` debe devolver el HTML del catálogo ya
renderizado en servidor (no una SPA vacía), y `docker inspect --format=
'{{.State.Health.Status}}' <contenedor>` debe marcar `healthy` a los pocos
segundos de arrancar.

### Conectar el contenedor con el backend en Docker — y por qué importa

El backend limita peticiones por IP (`docs/ARQUITECTURA.md` §7). El servidor
SSR de este sitio llama al backend **en cada render**, siempre desde la
misma IP del contenedor — sin excluirla, el sitio se autobloquea con `429`
en cuanto tenga algo de tráfico real. Por eso la IP (o el rango) del
contenedor de este sitio tiene que estar en `INTERNAL_CLIENTS` del `.env`
del backend.

Pasos, asumiendo que el backend ya corre con su propio `docker compose up`
(carpeta `shop-backend-service`, red creada automáticamente con el nombre
`shop-backend-service_default`):

```bash
# 1. Unir el contenedor de este sitio a la red del backend, y usar el
#    nombre del servicio (no localhost) para llegar a él.
docker run -d --name shop-dashboard-web \
  --network shop-backend-service_default \
  -p 4000:4000 \
  -e API_BASE_URL=http://backend:8080 \
  -e SITE_URL=http://localhost:4000 \
  shop-dashboard-web

# 2. Obtener la IP real que el demonio de Docker le asignó al contenedor.
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' shop-dashboard-web

# 3. Mejor que la IP suelta: el CIDR de la red completa, porque esa IP
#    cambia en cada arranque del contenedor y `INTERNAL_CLIENTS` sí acepta
#    rangos.
docker network inspect shop-backend-service_default \
  --format '{{(index .IPAM.Config 0).Subnet}}'
```

Añade el valor obtenido a `INTERNAL_CLIENTS` en el `.env` del backend
(acepta IPs sueltas y rangos CIDR mezclados, separados por coma) y reinicia
el backend:

```bash
# en shop-backend-service/.env
INTERNAL_CLIENTS=172.20.0.0/16
```

```bash
docker compose restart backend
```

Sin este paso, todas las peticiones del renderizado en servidor —que
comparten la misma IP del contenedor— cuentan contra el mismo límite que
cualquier visitante normal, y el sitio deja de poder renderizar en cuanto
se agota.

## Otros comandos

```bash
pnpm api:generate       # regenera src/app/api/ desde el OpenAPI del backend
pnpm extract-i18n       # extrae textos a messages.xlf
```

`src/app/api/` es generado — no se edita a mano (ver `CLAUDE.md`).
