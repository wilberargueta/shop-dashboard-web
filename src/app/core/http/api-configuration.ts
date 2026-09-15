import { Configuration } from '../../api/configuration';

/**
 * El OpenAPI del backend documenta sus respuestas con el tipo de contenido
 * comodín (springdoc no declara `produces`). `Configuration.selectHeaderAccept`
 * heredado no encuentra ningún candidato JSON en esa lista y el cliente
 * generado termina pidiendo la respuesta como blob en vez de como JSON — ver
 * `api/api/public-catalog-controller.service.ts`. Las respuestas son JSON de
 * verdad: se fuerza aquí, sin tocar `src/app/api/`. El origen real del
 * problema está en la documentación OpenAPI del backend.
 *
 * Si la API pública llega a exponer un endpoint que de verdad no sea JSON,
 * esta clase hay que revisarla entonces.
 */
export class ApiConfiguration extends Configuration {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma heredada de Configuration
  override selectHeaderAccept(contentTypes: string[]): string {
    return 'application/json';
  }
}
