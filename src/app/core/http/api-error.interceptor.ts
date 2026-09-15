import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError, ProblemDetail } from './problem-detail.model';

function isProblemDetail(body: unknown): body is ProblemDetail {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ProblemDetail).status === 'number' &&
    typeof (body as ProblemDetail).title === 'string'
  );
}

function parseRetryAfterSeconds(error: HttpErrorResponse): number | null {
  if (error.status !== 429) {
    return null;
  }
  const header = error.headers.get('Retry-After');
  if (header === null) {
    return null;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Traduce cualquier fallo HTTP (incluidos los de red, sin `status`) a un
 * `ApiError` tipado. Nunca deja pasar un `HttpErrorResponse` crudo.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        throw error;
      }

      const apiError: ApiError = {
        status: error.status,
        problem: isProblemDetail(error.error) ? error.error : null,
        retryAfterSeconds: parseRetryAfterSeconds(error),
      };

      return throwError(() => apiError);
    }),
  );
