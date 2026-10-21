/**
 * Ubicación del dispositivo para registrar apiarios y salas.
 *
 * Se pide alta precisión porque un apiario en el monte está a cientos de
 * metros del camino, y se acepta una lectura de hasta un minuto atrás para no
 * hacer esperar a quien acaba de abrir el mapa. Los errores vuelven en
 * castellano y dicen qué hacer.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** Radio de error en metros. */
  accuracy: number | null;
  capturedAt: number;
}

export class GeoError extends Error {
  constructor(
    message: string,
    readonly reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout',
  ) {
    super(message);
    this.name = 'GeoError';
  }
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

export const getCurrentPosition = (timeoutMs = 20_000): Promise<GeoPoint> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeoError('Este dispositivo no informa su ubicación.', 'unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: round(position.coords.latitude),
          longitude: round(position.coords.longitude),
          accuracy: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
          capturedAt: position.timestamp || Date.now(),
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new GeoError(
              'No diste permiso de ubicación. Activalo para ApiTrace en los ajustes del navegador y probá de nuevo.',
              'denied',
            ),
          );
        } else if (error.code === error.TIMEOUT) {
          reject(new GeoError('El GPS tardó demasiado. Probá a cielo abierto y tocá de nuevo.', 'timeout'));
        } else {
          reject(new GeoError('No se pudo obtener la ubicación. Revisá que el GPS esté encendido.', 'unavailable'));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });

/** -33.579100, -69.015800 → «-33.57910, -69.01580». */
export const formatPoint = (latitude: number | string, longitude: number | string): string =>
  `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;

/** Enlace para ver el punto o llegar con la aplicación de mapas del teléfono. */
export const directionsUrl = (latitude: number | string, longitude: number | string): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${Number(latitude)},${Number(longitude)}`;
