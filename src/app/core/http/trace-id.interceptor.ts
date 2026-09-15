import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Cabecera de traceId propia, generada en el cliente, para poder
 * correlacionar peticiones en los logs del navegador/servidor SSR. Es
 * distinta del `traceId` que el backend genera por su cuenta
 * (ARQUITECTURA.md §8) — ese ya viaja en el cuerpo de cada respuesta.
 */
export const traceIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { 'X-Client-Trace-Id': crypto.randomUUID() } }));
