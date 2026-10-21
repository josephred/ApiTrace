import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Tope del cuerpo JSON. El de Express (100 KB) no alcanza para el alta de un
 * apiario o una sala con su foto, que viaja en el mismo pedido (hasta ~4 MB en
 * base64). Se registra antes de `init()` para que Nest no agregue el parser por
 * defecto; lo usan main.ts y las pruebas e2e.
 */
export const JSON_BODY_LIMIT = '5mb';

export const applyBodyLimits = (app: NestExpressApplication): void => {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
};
