/**
 * Forma exacta de ARQUITECTURA.md §5.4 (RFC 9457 application/problem+json).
 */
export interface ProblemDetailFieldError {
  field: string;
  message: string;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId: string;
  errors?: ProblemDetailFieldError[];
}

/**
 * Error de aplicación al que el interceptor traduce cualquier fallo HTTP.
 * `problem` es null cuando el backend no devolvió un ProblemDetail válido
 * (caída de red, respuesta no-JSON, etc.): nunca debe reventar la app.
 */
export interface ApiError {
  status: number;
  problem: ProblemDetail | null;
  retryAfterSeconds: number | null;
}
