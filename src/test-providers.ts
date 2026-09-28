import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsSv from '@angular/common/locales/es-SV';

/**
 * Mismo locale que `app.config.ts` (W12): sin este registro, `CurrencyPipe`
 * cae por prefijo al `es` que registra `@angular/localize` a partir de
 * `angular.json` → `i18n.sourceLocale`, y formatea "20,00 US$" en vez de
 * "$20.00" — verificado que basta con el `LOCALE_ID` sin los datos
 * registrados para que ese fallback silencioso ocurra igual en tests.
 */
registerLocaleData(localeEsSv);

export default [{ provide: LOCALE_ID, useValue: 'es-SV' }];
