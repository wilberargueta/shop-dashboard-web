# syntax=docker/dockerfile:1

FROM node:24-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm build

FROM node:24-slim AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `node_modules` queda autocontenido (los symlinks de pnpm apuntan dentro de
# `.pnpm/`, con archivos enlazados por hardlink, no por symlink al store
# externo) -- verificado borrando el store de un contenedor ya arrancado y
# comprobando que el servidor sigue respondiendo. Sin este borrado, el store
# y la caché de descargas sin usar quedaban pesando ~750 MB de más en la
# imagen final (525 MB de store + 224 MB de `$HOME/.cache`).
RUN pnpm install --prod --frozen-lockfile && rm -rf "$(pnpm store path)" "$HOME/.cache"
COPY --from=build --chown=node:node /app/dist/shop-dashboard-web/browser ./dist/shop-dashboard-web/browser
COPY --from=build --chown=node:node /app/dist/shop-dashboard-web/server ./dist/shop-dashboard-web/server

USER node

ENV PORT=4000
EXPOSE 4000

# Sin `curl`/`wget` en `-slim`: se usa el `fetch` global de Node 24, ya
# disponible sin dependencias nuevas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/shop-dashboard-web/server/server.mjs"]
