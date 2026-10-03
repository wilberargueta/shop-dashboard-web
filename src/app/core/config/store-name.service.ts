import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, TransferState, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, map, of, timeout } from 'rxjs';
import { CatlogoPblicoService } from '../../api/api/catlogo-pblico.service';
import { cacheFirstValue } from '../http/transfer-state-cache';

/** Respaldo si el backend no responde a tiempo o no tiene un nombre configurado. */
export const DEFAULT_STORE_NAME = "Gabys Beauty's Store";

/** No bloquea el arranque (ni el render en servidor) más de esto esperando al backend. */
const LOAD_TIMEOUT_MS = 2000;

/**
 * Nombre de la tienda (`store.name`, "Datos de mi tienda" en el backoffice),
 * leído de `GET /api/public/v1/settings` antes de arrancar la aplicación
 * (`provideAppInitializer` en `app.config.ts`). En servidor se guarda en
 * `TransferState` para que el navegador no vuelva a pedirlo (mismo patrón que
 * `cacheFirstValue` en los lotes del catálogo).
 */
@Injectable({ providedIn: 'root' })
export class StoreName {
  private readonly api = inject(CatlogoPblicoService);
  private readonly transferState = inject(TransferState);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly value = signal(DEFAULT_STORE_NAME);

  async load(): Promise<void> {
    const name$ = this.api
      .get()
      .pipe(map((settings) => settings['store.name']?.trim() || DEFAULT_STORE_NAME));

    const name = await firstValueFrom(
      cacheFirstValue(this.transferState, this.isBrowser, 'store-name', name$).pipe(
        timeout(LOAD_TIMEOUT_MS),
        catchError(() => of(DEFAULT_STORE_NAME)),
      ),
    );
    this.value.set(name);
  }
}
