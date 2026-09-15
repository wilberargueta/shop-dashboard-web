import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from './api-error.interceptor';
import { ApiError, ProblemDetail } from './problem-detail.model';

describe('apiErrorInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('maps a ProblemDetail body to an ApiError 1:1', () => {
    const problem: ProblemDetail = {
      type: 'https://api.midominio.com/errors/validation',
      title: 'Datos inválidos',
      status: 400,
      detail: 'Parámetro de ordenamiento no válido',
      instance: '/api/public/v1/products',
      traceId: 'a1b2c3d4',
      errors: [{ field: 'sort', message: 'valor no permitido: bogus' }],
    };
    let captured: ApiError | undefined;

    httpClient.get('/api/public/v1/products').subscribe({
      error: (error: ApiError) => (captured = error),
    });

    httpTesting
      .expectOne('/api/public/v1/products')
      .flush(problem, { status: 400, statusText: 'Bad Request' });

    expect(captured).toEqual({ status: 400, problem, retryAfterSeconds: null });
  });

  it('exposes Retry-After on a 429 as retryAfterSeconds', () => {
    let captured: ApiError | undefined;

    httpClient.get('/api/public/v1/products').subscribe({
      error: (error: ApiError) => (captured = error),
    });

    httpTesting.expectOne('/api/public/v1/products').flush(
      { type: 'about:blank', title: 'Too Many Requests', status: 429, detail: '', instance: '' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '30' } },
    );

    expect(captured?.status).toBe(429);
    expect(captured?.retryAfterSeconds).toBe(30);
  });

  it('leaves retryAfterSeconds null on a 429 without the header', () => {
    let captured: ApiError | undefined;

    httpClient.get('/api/public/v1/products').subscribe({
      error: (error: ApiError) => (captured = error),
    });

    httpTesting
      .expectOne('/api/public/v1/products')
      .flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(captured?.retryAfterSeconds).toBeNull();
  });

  it('never leaves retryAfterSeconds set for a non-429 status', () => {
    let captured: ApiError | undefined;

    httpClient.get('/api/public/v1/products').subscribe({
      error: (error: ApiError) => (captured = error),
    });

    httpTesting.expectOne('/api/public/v1/products').flush(null, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Retry-After': '30' },
    });

    expect(captured?.retryAfterSeconds).toBeNull();
  });

  it('produces a typed ApiError with problem: null on a network failure, without throwing', () => {
    let captured: ApiError | undefined;

    httpClient.get('/api/public/v1/products').subscribe({
      error: (error: ApiError) => (captured = error),
    });

    httpTesting
      .expectOne('/api/public/v1/products')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(captured?.problem).toBeNull();
    expect(captured?.status).toBe(0);
  });

  it('passes a successful response through untouched', () => {
    let captured: unknown;

    httpClient.get('/api/public/v1/products').subscribe((response) => (captured = response));

    httpTesting.expectOne('/api/public/v1/products').flush({ content: [] });

    expect(captured).toEqual({ content: [] });
  });
});
