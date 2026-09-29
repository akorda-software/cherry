import type {
  PhotoUploadCompleteRequest,
  PhotoUploadIntent,
  PhotoUploadIntentRequest,
  ProfilePhoto
} from "@snack/contracts";

import {
  COMPRESSION_LADDER,
  DEFAULT_MAX_UPLOAD_BYTES,
  type CompressionAttempt
} from "../domain/compression-plan";
import { isSizeValidationError, PhotoUploadError, toPhotoUploadError } from "../domain/photo-errors";
import { overallUploadProgress, type PhotoUploadStage } from "../domain/photo-slots";
import { readUriAsBlob, uploadBinary, type BinaryUploader } from "../infrastructure/binary-upload";

/** Imagen elegida en el selector (galería o cámara). */
export interface PickedImage {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string | null;
}

/** Resultado de comprimir: siempre JPEG. */
export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
}

export type ImageCompressor = (image: PickedImage, attempt: CompressionAttempt) => Promise<CompressedImage>;

export interface PhotoUploadApi {
  createPhotoUploadIntent(request: PhotoUploadIntentRequest): Promise<PhotoUploadIntent>;
  completePhotoUpload(request: PhotoUploadCompleteRequest): Promise<ProfilePhoto>;
}

export interface PhotoUploadDeps {
  compress: ImageCompressor;
  readBlob?: (uri: string) => Promise<Blob>;
  upload?: BinaryUploader;
  ladder?: ReadonlyArray<CompressionAttempt>;
}

export interface PhotoUploadProgress {
  stage: PhotoUploadStage;
  /** Progreso global 0–1 (para la barra de la polaroid). */
  progress: number;
}

export interface UploadProfilePhotoInput {
  api: PhotoUploadApi;
  image: PickedImage;
  position: number;
  deps: PhotoUploadDeps;
  onProgress?: (progress: PhotoUploadProgress) => void;
  signal?: AbortSignal;
}

const CONTENT_TYPE = "image/jpeg" as const;

// Último `maxBytes` que ha dicho el servidor: la siguiente foto ya apunta ahí.
let knownMaxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES;

export function knownMaxBytes(): number {
  return knownMaxUploadBytes;
}

/** Solo para tests. */
export function resetKnownMaxBytes(value = DEFAULT_MAX_UPLOAD_BYTES): void {
  knownMaxUploadBytes = value;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  }
}

/**
 * Pipeline completo de una foto de perfil:
 * 1. comprime (3:4, ≤ 1440 px, JPEG ~0.8) y, si pesa más de `maxBytes`, reintenta más comprimida;
 * 2. pide el intent (`POST /api/me/photos/upload-intent`);
 * 3. sube el binario con `PUT uploadUrl` y TODOS los `headers` del intent;
 * 4. confirma (`POST /api/me/photos/complete`) y devuelve la foto registrada.
 * Los errores salen como `PhotoUploadError` (con `code` para el mensaje amable).
 */
export async function uploadProfilePhoto({
  api,
  image,
  position,
  deps,
  onProgress,
  signal
}: UploadProfilePhotoInput): Promise<ProfilePhoto> {
  const readBlob = deps.readBlob ?? readUriAsBlob;
  const upload = deps.upload ?? uploadBinary;
  const ladder = deps.ladder ?? COMPRESSION_LADDER;
  const report = (stage: PhotoUploadStage, fraction = 0) =>
    onProgress?.({ stage, progress: overallUploadProgress(stage, fraction) });

  try {
    report("preparing");

    let prepared: { image: CompressedImage; blob: Blob; intent: PhotoUploadIntent } | null = null;
    let maxBytes = knownMaxUploadBytes;

    for (const attempt of ladder) {
      throwIfAborted(signal);

      let compressed: CompressedImage;
      let blob: Blob;

      try {
        compressed = await deps.compress(image, attempt);
        blob = await readBlob(compressed.uri);
      } catch (error) {
        throw new PhotoUploadError("processing_failed", { cause: error });
      }

      if (!(blob.size > 0)) {
        throw new PhotoUploadError("processing_failed");
      }

      if (blob.size > maxBytes) {
        continue;
      }

      throwIfAborted(signal);

      try {
        const intent = await api.createPhotoUploadIntent({
          position,
          contentType: CONTENT_TYPE,
          sizeBytes: blob.size
        });

        if (typeof intent.maxBytes === "number" && intent.maxBytes > 0) {
          knownMaxUploadBytes = intent.maxBytes;
          maxBytes = intent.maxBytes;
        }

        if (blob.size > maxBytes) {
          continue;
        }

        prepared = { image: compressed, blob, intent };
        break;
      } catch (error) {
        if (isSizeValidationError(error)) {
          // El servidor admite menos de lo que creíamos: más compresión.
          maxBytes = Math.min(maxBytes, blob.size - 1);
          knownMaxUploadBytes = maxBytes;
          continue;
        }

        throw error;
      }
    }

    if (!prepared) {
      throw new PhotoUploadError("too_large");
    }

    const { intent, blob } = prepared;
    report("uploading", 0);

    await upload({
      url: intent.uploadUrl,
      method: intent.method ?? "PUT",
      headers: intent.headers ?? {},
      body: blob,
      signal,
      onProgress: (fraction) => report("uploading", fraction)
    });

    throwIfAborted(signal);
    report("confirming");

    return await api.completePhotoUpload({
      storageKey: intent.storageKey,
      publicUrl: intent.publicUrl,
      position,
      contentType: CONTENT_TYPE,
      sizeBytes: blob.size,
      width: prepared.image.width,
      height: prepared.image.height
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw toPhotoUploadError(error);
  }
}
