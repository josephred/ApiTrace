import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Violacion de una regla de negocio con codigo estable.
 *
 * El mensaje es para personas; el codigo es para programas: la aplicacion web
 * decide que mostrar mirando `code` (EXCESO_CANTIDAD_DECLARADA,
 * DTE_NO_VIGENTE, ...) y no parseando el texto, que puede cambiar de redaccion.
 * `details` lleva los datos que el cliente necesita para ofrecer una salida
 * (p. ej. la cantidad declarada y la intentada).
 */
export class DomainRuleException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super({ statusCode: status, error: code, message, details }, status);
  }
}
