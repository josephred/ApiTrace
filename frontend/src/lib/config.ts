/**
 * Resolucion de la URL base de la API.
 *
 * Render inyecta el host pelado (`apitrace-api.onrender.com`) cuando se usa
 * `fromService`, mientras que en desarrollo se prefiere la ruta relativa `/api`
 * para aprovechar el proxy de Vite y evitar CORS. Esta funcion normaliza ambos
 * casos para que el resto del codigo no tenga que pensarlo.
 */
const RAW = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_PREFIX = '/api/v1';

export const apiBaseUrl = ((): string => {
  if (RAW) {
    const withScheme = RAW.includes('://') ? RAW : `https://${RAW}`;
    const withoutTrailingSlash = withScheme.replace(/\/+$/, '');
    return withoutTrailingSlash.endsWith(API_PREFIX)
      ? withoutTrailingSlash
      : `${withoutTrailingSlash}${API_PREFIX}`;
  }
  // En despliegue en Render, si VITE_API_URL no llego al build:
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    const apiHost = window.location.hostname.replace('-web.', '-api.');
    return `https://${apiHost}${API_PREFIX}`;
  }
  return API_PREFIX; // desarrollo local: proxy de Vite hacia localhost:3000
})();

/** Health check: cuelga de la raiz del servicio, fuera del prefijo de la API. */
export const healthUrl = apiBaseUrl.replace(new RegExp(`${API_PREFIX}$`), '') + '/health';

export const APP_NAME = 'ApiTrace';
