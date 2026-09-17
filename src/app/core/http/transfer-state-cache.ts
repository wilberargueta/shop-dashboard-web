import { TransferState, makeStateKey } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

/**
 * `HttpTransferCache` (activado por `provideClientHydration()`) calcula su
 * clave a partir de la URL completa de la petición. `app.config.server.ts`
 * usa una URL absoluta y `app.config.ts` una relativa (PROJECT_SPEC.md §8),
 * así que servidor y navegador nunca comparten clave y el primer lote se
 * pide dos veces (caso 44). Este helper cachea por una clave propia, ajena
 * a la URL, así que funciona sin importar el origen de cada lado.
 *
 * En servidor: guarda el primer valor emitido. En navegador: si la clave
 * existe, emite ese valor sin llamar a la API y la borra — una recarga con
 * los mismos parámetros (o una página/filtro distintos, que nunca coincide
 * con ninguna clave del servidor) vuelve a pedir datos frescos con
 * normalidad.
 *
 * Recibe `isBrowser` ya resuelto (en vez de `PLATFORM_ID`) para no tener que
 * anotar su tipo (`Object` en los tipos de Angular) — el propio lint del
 * repo prohíbe los tipos "wrapper" en mayúscula.
 */
export function cacheFirstValue<T>(
  transferState: TransferState,
  isBrowser: boolean,
  key: string,
  source$: Observable<T>,
): Observable<T> {
  const stateKey = makeStateKey<T>(key);

  if (isBrowser) {
    if (transferState.hasKey(stateKey)) {
      const cached = transferState.get(stateKey, null as T);
      transferState.remove(stateKey);
      return of(cached);
    }
    return source$;
  }

  return source$.pipe(tap((value) => transferState.set(stateKey, value)));
}
