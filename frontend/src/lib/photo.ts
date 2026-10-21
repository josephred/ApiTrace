/**
 * Fotos de los maestros (apiario, sala, transporte), preparadas en el teléfono.
 *
 * Una foto de cámara pesa 3 a 6 MB. Se reduce acá, antes de guardarla o de
 * mandarla a la cola sin conexión: el lado mayor queda en 1280 px y JPEG al
 * 78 %, que ronda los 150 a 300 KB, y se genera una miniatura de 320 px para
 * los listados. Así la foto viaja en el mismo pedido que el alta y entra en
 * IndexedDB sin problema.
 */

export interface PreparedPhoto {
  dataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  /** Bytes aproximados de la foto ya comprimida. */
  bytes: number;
}

const FULL_MAX = 1280;
const THUMB_MAX = 320;
const QUALITY = 0.78;
const THUMB_QUALITY = 0.72;

/** Tamaño en bytes de un data URL base64. */
export const dataUrlBytes = (dataUrl: string): number => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

/** Medidas que entran en `max` conservando la proporción. */
export const fitWithin = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = url;
  });

const render = (image: CanvasImageSource, width: number, height: number, quality: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no permite procesar la foto.');
  // Fondo blanco: un PNG con transparencia no queda negro al pasar a JPEG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
};

/**
 * Reduce y comprime la foto elegida. Respeta la orientación EXIF: los
 * navegadores actuales ya entregan la imagen derecha al dibujarla.
 */
export const preparePhoto = async (file: File): Promise<PreparedPhoto> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Elegí una imagen (JPG, PNG o WebP).');
  }
  const image = await loadImage(file);
  const full = fitWithin(image.naturalWidth, image.naturalHeight, FULL_MAX);
  const thumb = fitWithin(image.naturalWidth, image.naturalHeight, THUMB_MAX);
  const dataUrl = render(image, full.width, full.height, QUALITY);
  const thumbnailDataUrl = render(image, thumb.width, thumb.height, THUMB_QUALITY);
  return { dataUrl, thumbnailDataUrl, width: full.width, height: full.height, bytes: dataUrlBytes(dataUrl) };
};

/** Lo que espera la API dentro del alta (`photo`). */
export const photoPayload = (photo: PreparedPhoto | null) =>
  photo
    ? {
        photo: {
          dataUrl: photo.dataUrl,
          thumbnailDataUrl: photo.thumbnailDataUrl,
          width: photo.width,
          height: photo.height,
        },
      }
    : {};
