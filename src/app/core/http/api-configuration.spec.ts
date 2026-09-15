import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Configuration } from '../../api/configuration';
import { PublicCatalogControllerService } from '../../api/api/public-catalog-controller.service';
import { ApiConfiguration } from './api-configuration';

describe('ApiConfiguration', () => {
  it('always resolves the JSON content type, regardless of what is offered', () => {
    const configuration = new ApiConfiguration({ basePath: '' });

    expect(configuration.selectHeaderAccept(['*/*'])).toBe('application/json');
    expect(configuration.selectHeaderAccept(['text/plain', 'application/xml'])).toBe(
      'application/json',
    );
  });

  describe('the generated client against a wildcard content-type backend', () => {
    let service: PublicCatalogControllerService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Configuration, useValue: new ApiConfiguration({ basePath: '' }) },
        ],
      });
      service = TestBed.inject(PublicCatalogControllerService);
      httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('parses the response as JSON instead of failing with NG02807 (Response is not a Blob)', () => {
      let result: unknown;

      service.listProducts().subscribe((response) => (result = response));

      const request = httpTesting.expectOne((req) => req.url === '/api/public/v1/products');
      // Reproduce lo que el backend real devuelve hoy: sin `produces`
      // declarado, springdoc documenta el tipo de contenido como comodín.
      request.flush(
        { content: [], page: 0, size: 12, totalElements: 0, totalPages: 0, hasNext: false },
        { headers: { 'Content-Type': 'application/json' } },
      );

      expect(result).toEqual({
        content: [],
        page: 0,
        size: 12,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
      });
    });
  });
});
