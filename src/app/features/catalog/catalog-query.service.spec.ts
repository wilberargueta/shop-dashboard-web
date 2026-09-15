import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { NavigationEnd, Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DEFAULT_CATALOG_FILTERS } from './catalog-query.model';
import { CatalogQueryService } from './catalog-query.service';

@Component({ template: '' })
class TestHostComponent {}

const TEST_ROUTES: Routes = [{ path: '**', component: TestHostComponent }];

describe('CatalogQueryService', () => {
  let harness: RouterTestingHarness;
  let service: CatalogQueryService;
  let location: Location;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(TEST_ROUTES), provideLocationMocks()],
    });

    harness = await RouterTestingHarness.create('/');
    service = TestBed.inject(CatalogQueryService);
    location = TestBed.inject(Location);

    // RouterTestingHarness bypasses ApplicationRef.bootstrap, so the Router
    // never wires up its popstate listener on its own (that normally happens
    // in the APP_BOOTSTRAP_LISTENER that calls initialNavigation()). Without
    // this, Location.back() would never reach the Router.
    TestBed.inject(Router).setUpLocationChangeListener();
  });

  it('reflects the categories and sort from the current URL (also covers reloading with filters already in the URL)', async () => {
    await harness.navigateByUrl('/?category=aceites&category=cremas&sort=price,asc');

    expect(service.filters().categories).toEqual(['aceites', 'cremas']);
    expect(service.filters().sort).toBe('price,asc');
  });

  it('falls back to defaults for a garbage URL without throwing', async () => {
    await expect(harness.navigateByUrl('/?sort=bogus&minPrice=abc&page=-3')).resolves.not.toThrow();

    expect(service.filters()).toEqual(DEFAULT_CATALOG_FILTERS);
    expect(service.page().page).toBe(0);
  });

  it('updateFilters writes the change to the URL and resets the page', async () => {
    service.updateFilters({ categories: ['aceites'] });
    await harness.fixture.whenStable();

    expect(service.filters().categories).toEqual(['aceites']);
    expect(location.path()).toContain('category=aceites');
  });

  it('the back button undoes the last filter change', async () => {
    const router = TestBed.inject(Router);

    service.updateFilters({ categories: ['aceites'] });
    await harness.fixture.whenStable();

    service.updateFilters({ categories: ['cremas'] });
    await harness.fixture.whenStable();

    const navigationEnd = firstValueFrom(
      router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    );
    location.back();
    await navigationEnd;

    expect(service.filters().categories).toEqual(['aceites']);
  });

  it('clearFilters leaves the URL without any params', async () => {
    service.updateFilters({ categories: ['aceites'], q: 'lavanda', sort: 'newest' });
    await harness.fixture.whenStable();

    service.clearFilters();
    await harness.fixture.whenStable();

    expect(location.path()).not.toContain('?');
    expect(service.filters()).toEqual(DEFAULT_CATALOG_FILTERS);
  });
});
