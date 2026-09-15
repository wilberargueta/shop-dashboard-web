import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { traceIdInterceptor } from './trace-id.interceptor';

describe('traceIdInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([traceIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('adds an X-Client-Trace-Id header shaped like a UUID to every request', () => {
    httpClient.get('/api/public/v1/categories').subscribe();

    const request = httpTesting.expectOne('/api/public/v1/categories');
    const traceId = request.request.headers.get('X-Client-Trace-Id');

    expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    request.flush([]);
  });

  it('generates a different trace id for each request', () => {
    httpClient.get('/api/public/v1/categories').subscribe();
    httpClient.get('/api/public/v1/categories').subscribe();

    const [first, second] = httpTesting.match('/api/public/v1/categories');
    expect(first.request.headers.get('X-Client-Trace-Id')).not.toBe(
      second.request.headers.get('X-Client-Trace-Id'),
    );
    first.flush([]);
    second.flush([]);
  });
});
