import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { PickedImage } from "../application/upload-photo";

export type PhotoSource = "library" | "camera";

export type PickPhotosResult =
  | { status: "picked"; images: PickedImage[] }
  | { status: "canceled" }
  | { status: "permission_denied"; canAskAgain: boolean };

/** La cámara solo tiene sentido en el móvil (en web el input de fichero ya ofrece la galería). */
export const cameraAvailable = Platform.OS === "ios" || Platform.OS === "android";

function toPickedImages(result: ImagePicker.ImagePickerResult): PickedImage[] {
  if (result.canceled) {
    return [];
  }

  return (result.assets ?? [])
    .filter((asset) => asset.type === undefined || asset.type === null || asset.type === "image")
    .map((asset) => ({
      uri: asset.uri,
      width: asset.width || undefined,
      height: asset.height || undefined,
      mimeType: asset.mimeType ?? null
    }));
}

/**
 * Abre la galería (varias a la vez, hasta los huecos libres) o la cámara.
 * No pide recorte al selector: en iOS solo sabe recortar cuadrado, así que el
 * 3:4 lo hace el compresor (centrado) igual en todas las plataformas.
 */
export async function pickPhotos(source: PhotoSource, limit: number): Promise<PickPhotosResult> {
  if (limit <= 0) {
    return { status: "canceled" };
  }

  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      return { status: "permission_denied", canAskAgain: permission.canAskAgain };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
      cameraType: ImagePicker.CameraType.front
    });
    const images = toPickedImages(result);
    return images.length > 0 ? { status: "picked", images: images.slice(0, 1) } : { status: "canceled" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1,
    exif: false
  });
  const images = toPickedImages(result);
  return images.length > 0 ? { status: "picked", images: images.slice(0, limit) } : { status: "canceled" };
}
