/**
 * Plan de compresión de fotos de perfil: recorte centrado a 3:4 (retrato, el
 * marco polaroid), lado largo ≤ 1440 px y JPEG ~0.8. Si aun así pesa más de lo
 * que admite el servidor, se reintenta con escalones más agresivos.
 */
export const PHOTO_ASPECT_RATIO = 3 / 4;
export const MAX_PHOTO_LONG_SIDE = 1440;
/** Límite por defecto del backend (`max_upload_bytes`); el intent devuelve el real. */
export const DEFAULT_MAX_UPLOAD_BYTES = 2_000_000;
/** Tolerancia para no recortar fotos que ya son 3:4 (p. ej. recortadas en el selector). */
const ASPECT_TOLERANCE = 0.01;

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface CompressionAttempt {
  quality: number;
  maxLongSide: number;
}

export const COMPRESSION_LADDER: ReadonlyArray<CompressionAttempt> = [
  { quality: 0.8, maxLongSide: MAX_PHOTO_LONG_SIDE },
  { quality: 0.68, maxLongSide: MAX_PHOTO_LONG_SIDE },
  { quality: 0.6, maxLongSide: 1280 },
  { quality: 0.5, maxLongSide: 1080 },
  { quality: 0.42, maxLongSide: 960 }
];

/** Rectángulo centrado con proporción `aspect` (ancho/alto), o `null` si ya la tiene. */
export function centerCropRect(width: number, height: number, aspect = PHOTO_ASPECT_RATIO): CropRect | null {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const current = width / height;

  if (Math.abs(current - aspect) / aspect <= ASPECT_TOLERANCE) {
    return null;
  }

  if (current > aspect) {
    // Demasiado ancha: se recortan los lados.
    const cropWidth = Math.max(1, Math.round(height * aspect));
    return { originX: Math.floor((width - cropWidth) / 2), originY: 0, width: cropWidth, height };
  }

  // Demasiado alta: se recorta arriba y abajo.
  const cropHeight = Math.max(1, Math.round(width / aspect));
  return { originX: 0, originY: Math.floor((height - cropHeight) / 2), width, height: cropHeight };
}

/** Tamaño final con el lado largo ≤ `maxLongSide`, o `null` si no hace falta reducir. */
export function resizeTarget(
  width: number,
  height: number,
  maxLongSide = MAX_PHOTO_LONG_SIDE
): { width: number; height: number } | null {
  const longSide = Math.max(width, height);

  if (!(longSide > maxLongSide)) {
    return null;
  }

  const scale = maxLongSide / longSide;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Dimensiones tras recortar y reducir (para el `complete` y las previsualizaciones). */
export function plannedOutputSize(width: number, height: number, attempt: CompressionAttempt): { width: number; height: number } {
  const crop = centerCropRect(width, height);
  const base = crop ? { width: crop.width, height: crop.height } : { width, height };
  return resizeTarget(base.width, base.height, attempt.maxLongSide) ?? base;
}
