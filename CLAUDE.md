# Instrucciones para Claude Code — tienda-web

Sitio público de la tienda. Angular 22 con SSR.

## Documentos que debes conocer

- `PROJECT_SPEC.md` — pantallas, grid, WhatsApp, SEO, pruebas exigidas.
- `docs/ARQUITECTURA.md` — contrato de API, marcadores de plantilla, decisiones cerradas.
- `ROADMAP.md` — las tareas, en orden.

Léelos al empezar cualquier tarea no trivial.

---

## Stack

Angular 22 · TypeScript estricto · `@angular/ssr` · pnpm · Node 24 LTS ·
Vitest (o el runner que traiga el CLI de Angular 22) · Angular Testing Library ·
Playwright · `@axe-core/playwright` · `@angular/localize`

**Sin librería de componentes UI.** Angular Material va en el backoffice, no
aquí: el sitio público necesita ser ligero y son tres pantallas. CSS propio o
Tailwind.

### Angular 22 no es Angular 17

- `OnPush` es el valor por defecto. `ChangeDetectionStrategy.Default` está
  deprecado a favor de `Eager`.
- `HttpClient` usa `FetchBackend` por defecto; `withFetch()` está deprecado.
- `resource`, `rxResource`, `httpResource` y Signal Forms son estables. Úsalos
  en lugar de cadenas manuales de RxJS.
- La hidratación incremental está activa por defecto.
- **Componentes standalone siempre. Cero NgModules.**
- Control de flujo con `@if`, `@for`, `@switch`. Nunca `*ngIf` ni `*ngFor`.
- Sin `zone.js`: aplicación sin zonas, con signals.

---

## Comandos

```bash
pnpm install
pnpm start                  # dev server con SSR
pnpm build                  # build de producción (navegador + servidor)
pnpm test                   # unitarias y de componentes
pnpm test --watch
pnpm e2e                    # Playwright (necesita el backend levantado)
pnpm lint
pnpm api:generate           # regenera el cliente desde el OpenAPI del backend
pnpm lighthouse             # auditoría contra el build de producción
```

El backend debe estar corriendo en `http://localhost:8080` para desarrollo.
Levántalo desde el repo `tienda-backend` con `docker compose up`.

---

## Cómo se trabaja una tarea

1. Lee la tarea completa en `ROADMAP.md`, con sus criterios de aceptación.
2. Si contradice `ARQUITECTURA.md` o es ambigua de un modo que cambia el diseño,
   **pregunta antes de implementar**.
3. Implementa.
4. Escribe los tests. Son parte de la tarea.
5. `pnpm lint && pnpm test && pnpm build`. Todo en verde antes de seguir.
6. Commit único en Conventional Commits.
7. Marca la tarea y anota desviaciones.

---

## Reglas de código

### Angular

- Componentes standalone. Nada de NgModules.
- **Signals para todo el estado.** `signal`, `computed`, `linkedSignal`.
  RxJS solo donde aporte algo real (debounce de la búsqueda, por ejemplo), y
  siempre convertido a signal con `toSignal` en el borde del componente.
- `input()` / `output()` como funciones, no los decoradores `@Input`/`@Output`.
- `inject()` en lugar de inyección por constructor.
- Un componente que hace más de una cosa se parte. Si una plantilla pasa de
  ~80 líneas, es señal de que hay que dividir.
- Los componentes de presentación no llaman a la API. Los datos entran por
  `input()`. Las llamadas viven en servicios.
- Nada de `any`. TypeScript en modo estricto, `strictTemplates` activado.
- `trackBy` (o la expresión `track` de `@for`) siempre en las listas. Sin eso,
  el grid recrea todas las tarjetas en cada lote nuevo.

### SSR — lee esto antes de tocar código

Es donde más se rompe. En el servidor **no existen** `window`, `document`,
`localStorage`, `sessionStorage`, `navigator`, `IntersectionObserver` ni
`matchMedia`.

- Todo acceso a APIs del navegador va dentro de `afterNextRender` o tras una
  guarda de plataforma.
- El servicio de selección debe funcionar en servidor devolviendo vacío, no
  reventando.
- Las URLs de la API deben ser absolutas en servidor.
- Nunca dejes un `setTimeout` o `setInterval` sin limpiar: retiene el
  renderizado y la respuesta del servidor nunca se envía.
- Tras cualquier cambio, **prueba con SSR activo**, no solo con `ng serve`.
  Un error de SSR no aparece en el modo de desarrollo del navegador.

### Estado y URL

El estado de navegación (filtros, búsqueda, orden, página) vive en los
**parámetros de la URL**, no en un servicio. La URL es la fuente de verdad; los
servicios la leen y la escriben. Eso es lo que hace que compartir un enlace, el
botón atrás y el SSR funcionen sin código extra.

### Cliente de API

- `src/app/api/` es **generado**. No lo edites nunca a mano.
- Si necesitas un campo que no existe, el cambio es en el backend, no aquí.
- Tras un cambio del backend: `pnpm api:generate` y arregla lo que TypeScript
  señale.

### Estilos

- CSS con variables para colores, espaciados y tipografía. Nada de valores
  mágicos repartidos.
- Diseño para móvil primero.
- Sin `!important` salvo que sobreescribas estilos de terceros y lo justifiques.
- `prefers-reduced-motion` respetado en toda animación.

### Textos

**Cero cadenas de interfaz incrustadas.** Todo texto visible va a los archivos
de traducción desde el primer día, aunque solo haya español. Fechas, números y
moneda con los pipes localizados de Angular, nunca con formato manual.

### Accesibilidad

No es una fase final. En cada componente:

- Operable con teclado.
- Foco visible.
- Etiquetas y roles ARIA correctos.
- Contraste suficiente.
- Los cambios dinámicos anunciados con `aria-live`.

Si un componente no se puede usar con teclado, no está terminado.

---

## Pruebas

- Los tests se escriben **con** la funcionalidad, no después.
- Los de componentes prueban lo que el usuario ve y hace (Testing Library),
  no los métodos internos de la clase.
- Los selectores de Playwright son por rol y texto accesible
  (`getByRole('button', { name: 'Enviar por WhatsApp' })`), nunca por clase CSS
  ni por `data-testid` salvo que no haya alternativa.
- **El servicio de renderizado de plantillas de WhatsApp se cubre al 100 %.**
  Es lo que decide si una venta ocurre; cabe en cien líneas.
- Nunca marques una tarea completa con tests en rojo o deshabilitados.

---

## Rendimiento

Antes de añadir una dependencia, pregúntate si de verdad hace falta. El
presupuesto de JS inicial es de 200 KB comprimidos y hay que respetarlo.

- Rutas y componentes pesados con carga diferida.
- Imágenes con `<picture>`, WebP, `srcset`, dimensiones declaradas.
- `loading="lazy"` salvo en las primeras tarjetas visibles.
- Sin librerías de utilidades que dupliquen lo que hace el propio lenguaje.

---

## Git

Conventional Commits, mensajes en inglés. Ramas `feat/…`, `fix/…`.
`main` protegida. No hagas commit ni push sin que te lo pidan.

---

## Qué hacer cuando algo no cuadra

- **Especificación ambigua** → pregunta antes de implementar.
- **Falta un campo en la API** → dilo; el cambio es en el backend. No lo
  calcules en el frontend ni lo inventes.
- **Una decisión de `ARQUITECTURA.md` §9 te parece mal** → exponlo con tu
  razonamiento, no la cambies por tu cuenta.
- **Un test falla y no entiendes por qué** → investígalo. No lo deshabilites ni
  relajes la aserción.
- **Lighthouse no llega al objetivo** → dilo con los números concretos y qué lo
  está causando.

---

## Qué no hacer

- No llamar nunca a `/api/admin/**` desde aquí.
- No poner lógica de precios ni de visibilidad en el frontend. Lo que llega de la
  API se muestra tal cual.
- No guardar precios en `sessionStorage`. Solo `{ productId, cantidad }`.
- No usar `localStorage` para la selección.
- No usar `bypassSecurityTrustHtml` con contenido de la API.
- No añadir una librería de componentes UI.
- No editar `src/app/api/`.
- No dejar cadenas de interfaz fuera de los archivos de traducción.
- No dejar `TODO`, `FIXME` ni código comentado en un commit.
- No crear documentación que nadie pidió.
