import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { centerCropRect, resizeTarget, type CompressionAttempt } from "../domain/compression-plan";
import type { CompressedImage, ImageCompressor, PickedImage } from "../application/upload-photo";

interface Releasable {
  release?: () => void;
}

function release(...objects: Array<Releasable | null | undefined>) {
  for (const object of objects) {
    try {
      object?.release?.();
    } catch {
      // Liberar memoria nativa es best-effort.
    }
  }
}

/**
 * Compresión nativa (y canvas en web) con expo-image-manipulator: primero se
 * decodifica la imagen tal cual (ya con la orientación EXIF aplicada, así las
 * medidas son las reales), luego recorte centrado 3:4, reducción del lado largo
 * y JPEG con la calidad del escalón.
 */
export const compressWithManipulator: ImageCompressor = async (
  image: PickedImage,
  attempt: CompressionAttempt
): Promise<CompressedImage> => {
  const sourceContext = ImageManipulator.manipulate(image.uri);
  const source = await sourceContext.renderAsync();
  const context = ImageManipulator.manipulate(source);

  try {
    let width = source.width;
    let height = source.height;
    const crop = centerCropRect(width, height);

    if (crop) {
      context.crop(crop);
      width = crop.width;
      height = crop.height;
    }

    const resize = resizeTarget(width, height, attempt.maxLongSide);

    if (resize) {
      context.resize(resize);
    }

    const output = await context.renderAsync();

    try {
      const saved = await output.saveAsync({ compress: attempt.quality, format: SaveFormat.JPEG });
      return { uri: saved.uri, width: saved.width, height: saved.height };
    } finally {
      release(output);
    }
  } finally {
    release(context, source, sourceContext);
  }
};
