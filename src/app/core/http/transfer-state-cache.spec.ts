import { TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of } from 'rxjs';
import { cacheFirstValue } from './transfer-state-cache';

describe('cacheFirstValue', () => {
  let transferState: TransferState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    transferState = TestBed.inject(TransferState);
  });

  it('stores the first emitted value under the given key when run on the server', async () => {
    const result = await firstValueFrom(cacheFirstValue(transferState, false, 'catalog-page-0', of({ page: 0 })));

    expect(result).toEqual({ page: 0 });
    expect(transferState.get(makeStateKey<{ page: number }>('catalog-page-0'), null)).toEqual({ page: 0 });
  });

  it('reads the cached value on the browser without subscribing to the source', async () => {
    transferState.set(makeStateKey<{ page: number }>('catalog-page-0'), { page: 0 });
    let sourceSubscribed = false;
    const source$ = new Observable<{ page: number }>((subscriber) => {
      sourceSubscribed = true;
      subscriber.next({ page: 99 });
      subscriber.complete();
    });

    const result = await firstValueFrom(cacheFirstValue(transferState, true, 'catalog-page-0', source$));

    expect(sourceSubscribed).toBe(false);
    expect(result).toEqual({ page: 0 });
  });

  it('removes the key after reading it on the browser, so a later call with the same key hits the source again', async () => {
    transferState.set(makeStateKey<{ id: string }>('product-slug'), { id: 'cached' });

    const first = await firstValueFrom(cacheFirstValue(transferState, true, 'product-slug', of({ id: 'ignored' })));
    const second = await firstValueFrom(cacheFirstValue(transferState, true, 'product-slug', of({ id: 'fresh' })));

    expect(first).toEqual({ id: 'cached' });
    expect(second).toEqual({ id: 'fresh' });
  });

  it('calls the source on the browser when no cached value exists for the key', async () => {
    const result = await firstValueFrom(cacheFirstValue(transferState, true, 'never-cached', of({ ok: true })));

    expect(result).toEqual({ ok: true });
  });
});
