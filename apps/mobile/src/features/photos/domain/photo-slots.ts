import { MAX_PROFILE_PHOTOS, MIN_PROFILE_PHOTOS, type ProfilePhoto } from "@snack/contracts";

export { MAX_PROFILE_PHOTOS, MIN_PROFILE_PHOTOS };

/** Posiciones válidas en backend: 1..4 (la 1ª por posición es la principal). */
export const PHOTO_POSITIONS: ReadonlyArray<number> = Array.from({ length: MAX_PROFILE_PHOTOS }, (_, index) => index + 1);

export type PhotoUploadStage = "preparing" | "uploading" | "confirming";

/** Subida en curso o fallida (aún no es una foto del perfil). */
export interface PendingPhoto {
  key: string;
  localUri: string;
  /** Posición reservada para el intent. */
  position: number;
  stage: PhotoUploadStage;
  /** 0–1 de toda la subida (preparar + subir + confirmar). */
  progress: number;
  error: string | null;
  /** Si reintentar la misma foto puede funcionar (no lo hará con «no se puede usar esta imagen»). */
  retryable?: boolean;
}

export type PhotoSlot =
  | { kind: "photo"; key: string; photo: ProfilePhoto; isMain: boolean }
  | { kind: "pending"; key: string; pending: PendingPhoto }
  | { kind: "empty"; key: string; index: number };

/** Fotos activas ordenadas por posición (el perfil propio también trae las borradas). */
export function activePhotos(photos: ReadonlyArray<ProfilePhoto> | null | undefined): ProfilePhoto[] {
  return (photos ?? []).filter((photo) => photo.isActive).sort((a, b) => a.position - b.position);
}

/** Primera posición libre (ni ocupada ni reservada por otra subida), o `null` si no queda hueco. */
export function nextFreePosition(
  photos: ReadonlyArray<Pick<ProfilePhoto, "position">>,
  reserved: ReadonlyArray<number> = []
): number | null {
  const taken = new Set([...photos.map((photo) => photo.position), ...reserved]);
  return PHOTO_POSITIONS.find((position) => !taken.has(position)) ?? null;
}

/** Huecos que quedan contando las subidas en marcha (y las fallidas, que ocupan su hueco). */
export function remainingPhotoSlots(photoCount: number, pendingCount: number): number {
  return Math.max(0, MAX_PROFILE_PHOTOS - photoCount - pendingCount);
}

/** Ids en el orden de `PUT /api/me/photos/order` con `photoId` como principal. */
export function orderWithMainFirst(photos: ReadonlyArray<ProfilePhoto>, photoId: string): string[] | null {
  const ordered = activePhotos(photos);

  if (!ordered.some((photo) => photo.id === photoId) || ordered[0]?.id === photoId) {
    return null;
  }

  return [photoId, ...ordered.filter((photo) => photo.id !== photoId).map((photo) => photo.id)];
}

export type PhotoManagerMode = "onboarding" | "edit";

/**
 * En edición no se puede bajar del mínimo: el perfil dejaría de estar completo
 * (y de salir en Descubrir). En el onboarding sí, porque aún no está publicado.
 */
export function canRemovePhoto(photoCount: number, mode: PhotoManagerMode): boolean {
  return mode === "onboarding" || photoCount > MIN_PROFILE_PHOTOS;
}

/**
 * Rejilla de 4 huecos: primero las fotos (por posición; la primera es la
 * principal), luego las subidas en marcha/fallidas (por posición reservada) y
 * al final los huecos vacíos.
 */
export function buildPhotoSlots(
  photos: ReadonlyArray<ProfilePhoto>,
  pending: ReadonlyArray<PendingPhoto>
): PhotoSlot[] {
  const ordered = activePhotos(photos);
  const slots: PhotoSlot[] = ordered.map((photo, index) => ({
    kind: "photo",
    key: `photo-${photo.id}`,
    photo,
    isMain: index === 0
  }));

  [...pending]
    .sort((a, b) => a.position - b.position)
    .forEach((item) => slots.push({ kind: "pending", key: `pending-${item.key}`, pending: item }));

  for (let index = slots.length; index < MAX_PROFILE_PHOTOS; index += 1) {
    slots.push({ kind: "empty", key: `empty-${index}`, index });
  }

  return slots.slice(0, MAX_PROFILE_PHOTOS);
}

/** Progreso global 0–1 a partir de la etapa y del avance de la subida binaria. */
export function overallUploadProgress(stage: PhotoUploadStage, uploadFraction = 0): number {
  const clamped = Math.min(1, Math.max(0, uploadFraction));

  switch (stage) {
    case "preparing":
      return 0.08;
    case "uploading":
      return 0.15 + clamped * 0.75;
    case "confirming":
      return 0.94;
  }
}
