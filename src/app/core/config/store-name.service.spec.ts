import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { CatlogoPblicoService } from '../../api/api/catlogo-pblico.service';
import { DEFAULT_STORE_NAME, StoreName } from './store-name.service';

describe('StoreName', () => {
  let get: ReturnType<typeof vi.fn>;

  function setup(platform: 'browser' | 'server' = 'server'): StoreName {
    TestBed.configureTestingModule({
      providers: [
        { provide: CatlogoPblicoService, useValue: { get } },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    return TestBed.inject(StoreName);
  }

  beforeEach(() => {
    get = vi.fn();
  });

  it('starts with the fallback name until the settings are loaded', () => {
    expect(setup().value()).toBe(DEFAULT_STORE_NAME);
  });

  it('uses the store name configured in the backoffice (trimmed)', async () => {
    get.mockReturnValue(of({ 'store.name': '  Salón de Gaby  ' }));
    const store = setup();

    await store.load();

    expect(store.value()).toBe('Salón de Gaby');
  });

  it('falls back when the store name is blank or missing', async () => {
    get.mockReturnValue(of({ 'store.name': '   ' }));
    const blank = setup();
    await blank.load();
    expect(blank.value()).toBe(DEFAULT_STORE_NAME);

    TestBed.resetTestingModule();
    get.mockReturnValue(of({}));
    const missing = setup();
    await missing.load();
    expect(missing.value()).toBe(DEFAULT_STORE_NAME);
  });

  it('falls back when the request fails, without throwing', async () => {
    get.mockReturnValue(throwError(() => ({ status: 0, problem: null, retryAfterSeconds: null })));
    const store = setup();

    await expect(store.load()).resolves.toBeUndefined();

    expect(store.value()).toBe(DEFAULT_STORE_NAME);
  });

  it('falls back instead of blocking startup when the backend never answers', async () => {
    vi.useFakeTimers();
    try {
      get.mockReturnValue(NEVER);
      const store = setup();

      const loading = store.load();
      await vi.advanceTimersByTimeAsync(2000);
      await loading;

      expect(store.value()).toBe(DEFAULT_STORE_NAME);
    } finally {
      vi.useRealTimers();
    }
  });

  it('on the server, saves the name in TransferState so the browser does not ask again', async () => {
    get.mockReturnValue(of({ 'store.name': 'Salón de Gaby' }));
    const store = setup('server');

    await store.load();

    expect(TestBed.inject(TransferState).get(makeStateKey<string>('store-name'), null)).toBe('Salón de Gaby');
  });

  it('in the browser, takes the name from TransferState without making the request', async () => {
    let requested = false;
    get.mockReturnValue(new Observable(() => void (requested = true)));
    const store = setup('browser');
    TestBed.inject(TransferState).set(makeStateKey<string>('store-name'), 'Salón de Gaby');

    await store.load();

    expect(store.value()).toBe('Salón de Gaby');
    expect(requested).toBe(false);
  });
});
