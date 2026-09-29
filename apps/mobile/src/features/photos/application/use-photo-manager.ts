import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PhotoUploadCompleteRequest, PhotoUploadIntent, PhotoUploadIntentRequest, ProfilePhoto } from "@snack/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import { isRetryablePhotoError, photoErrorMessage } from "../domain/photo-errors";
import {
  activePhotos,
  buildPhotoSlots,
  canRemovePhoto,
  MIN_PROFILE_PHOTOS,
  nextFreePosition,
  orderWithMainFirst,
  remainingPhotoSlots,
  type PendingPhoto,
  type PhotoManagerMode,
  type PhotoSlot
} from "../domain/photo-slots";
import type { BinaryUploader } from "../infrastructure/binary-upload";
import type { PhotoSource, PickPhotosResult } from "../infrastructure/image-picker";
import { uploadProfilePhoto, type ImageCompressor, type PickedImage } from "./upload-photo";

export interface PhotoManagerApi {
  listPhotos(): Promise<ProfilePhoto[]>;
  createPhotoUploadIntent(request: PhotoUploadIntentRequest): Promise<PhotoUploadIntent>;
  completePhotoUpload(request: PhotoUploadCompleteRequest): Promise<ProfilePhoto>;
  deletePhoto(photoId: string): Promise<void>;
  reorderPhotos(photoIds: string[]): Promise<ProfilePhoto[]>;
}

export interface PhotoNotice {
  message: string;
  /** La UI ofrece abrir Ajustes (permiso de cámara denegado para siempre). */
  action?: "settings";
}

export interface UsePhotoManagerOptions {
  api: PhotoManagerApi;
  mode: PhotoManagerMode;
  initialPhotos?: ReadonlyArray<ProfilePhoto>;
  pick: (source: PhotoSource, limit: number) => Promise<PickPhotosResult>;
  compress: ImageCompressor;
  upload?: BinaryUploader;
  readBlob?: (uri: string) => Promise<Blob>;
  /** Cada vez que cambian las fotos confirmadas (para sincronizar el borrador del perfil). */
  onPhotosChange?: (photos: ProfilePhoto[]) => void;
  createKey?: () => string;
}

export interface PhotoManager {
  photos: ProfilePhoto[];
  pending: PendingPhoto[];
  slots: PhotoSlot[];
  uploadedCount: number;
  /** Hay alguna subida en marcha (no cuenta las fallidas). */
  uploading: boolean;
  remaining: number;
  canAdd: boolean;
  /** ≥ 2 fotos y nada subiendo. */
  canContinue: boolean;
  /** Foto sobre la que se está borrando o reordenando. */
  busyPhotoId: string | null;
  notice: PhotoNotice | null;
  clearNotice(): void;
  add(source: PhotoSource): Promise<void>;
  addImages(images: ReadonlyArray<PickedImage>): void;
  retry(key: string): void;
  discard(key: string): void;
  canRemove(photoId: string): boolean;
  remove(photoId: string): Promise<boolean>;
  makeMain(photoId: string): Promise<boolean>;
  reload(): Promise<void>;
}

let keySeed = 0;
const defaultKey = () => `upload-${Date.now().toString(36)}-${(keySeed += 1)}`;

export function usePhotoManager({
  api,
  mode,
  initialPhotos = [],
  pick,
  compress,
  upload,
  readBlob,
  onPhotosChange,
  createKey = defaultKey
}: UsePhotoManagerOptions): PhotoManager {
  const [photos, setPhotosState] = useState<ProfilePhoto[]>(() => activePhotos(initialPhotos));
  const [pending, setPendingState] = useState<PendingPhoto[]>([]);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [notice, setNotice] = useState<PhotoNotice | null>(null);

  // Espejos síncronos para calcular posiciones libres sin carreras entre subidas.
  const photosRef = useRef(photos);
  const pendingRef = useRef(pending);
  const imagesRef = useRef(new Map<string, PickedImage>());
  const mountedRef = useRef(true);
  const onPhotosChangeRef = useRef(onPhotosChange);
  onPhotosChangeRef.current = onPhotosChange;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setPhotos = useCallback((updater: (current: ProfilePhoto[]) => ProfilePhoto[]) => {
    const next = activePhotos(updater(photosRef.current));
    photosRef.current = next;

    if (mountedRef.current) {
      setPhotosState(next);
    }

    onPhotosChangeRef.current?.(next);
  }, []);

  const setPending = useCallback((updater: (current: PendingPhoto[]) => PendingPhoto[]) => {
    pendingRef.current = updater(pendingRef.current);

    if (mountedRef.current) {
      setPendingState(pendingRef.current);
    }
  }, []);

  const patchPending = useCallback(
    (key: string, patch: Partial<PendingPhoto>) =>
      setPending((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item))),
    [setPending]
  );

  const run = useCallback(
    async (key: string) => {
      const image = imagesRef.current.get(key);
      const item = pendingRef.current.find((entry) => entry.key === key);

      if (!image || !item) {
        return;
      }

      try {
        const photo = await uploadProfilePhoto({
          api,
          image,
          position: item.position,
          deps: { compress, upload, readBlob },
          onProgress: ({ stage, progress }) => patchPending(key, { stage, progress })
        });

        imagesRef.current.delete(key);
        setPending((current) => current.filter((entry) => entry.key !== key));
        setPhotos((current) => [...current.filter((existing) => existing.id !== photo.id), photo]);
      } catch (error) {
        patchPending(key, { error: photoErrorMessage(error), retryable: isRetryablePhotoError(error), progress: 0 });
      }
    },
    [api, compress, patchPending, readBlob, setPending, setPhotos, upload]
  );

  const addImages = useCallback(
    (images: ReadonlyArray<PickedImage>) => {
      const started: string[] = [];

      for (const image of images) {
        const reserved = pendingRef.current.map((entry) => entry.position);
        const position = nextFreePosition(photosRef.current, reserved);

        if (position === null) {
          setNotice({ message: "Ya tienes 4 fotos. Quita una para añadir otra." });
          break;
        }

        const key = createKey();
        imagesRef.current.set(key, image);
        setPending((current) => [
          ...current,
          { key, localUri: image.uri, position, stage: "preparing", progress: 0, error: null }
        ]);
        started.push(key);
      }

      started.forEach((key) => void run(key));
    },
    [createKey, run, setPending]
  );

  const add = useCallback(
    async (source: PhotoSource) => {
      const limit = remainingPhotoSlots(photosRef.current.length, pendingRef.current.length);

      if (limit <= 0) {
        setNotice({ message: "Ya tienes 4 fotos. Quita una para añadir otra." });
        return;
      }

      setNotice(null);

      try {
        const result = await pick(source, limit);

        if (result.status === "permission_denied") {
          setNotice(
            result.canAskAgain
              ? { message: "Necesitamos permiso para usar la cámara. También puedes elegir fotos de tu galería." }
              : {
                  message: "La cámara está bloqueada para Snack. Puedes activarla en Ajustes o elegir fotos de tu galería.",
                  action: "settings"
                }
          );
          return;
        }

        if (result.status === "picked") {
          addImages(result.images);
        }
      } catch (error) {
        setNotice({ message: friendlyErrorMessage(error, "No hemos podido abrir tus fotos. Inténtalo otra vez.") });
      }
    },
    [addImages, pick]
  );

  const retry = useCallback(
    (key: string) => {
      const item = pendingRef.current.find((entry) => entry.key === key);

      if (!item || item.error === null) {
        return;
      }

      const reserved = pendingRef.current.filter((entry) => entry.key !== key).map((entry) => entry.position);
      const stillFree = nextFreePosition(photosRef.current, reserved);
      const takenByPhoto = photosRef.current.some((photo) => photo.position === item.position);
      const position = takenByPhoto ? stillFree : item.position;

      if (position === null) {
        patchPending(key, { error: "Ya tienes 4 fotos. Quita una para añadir otra." });
        return;
      }

      patchPending(key, { position, error: null, stage: "preparing", progress: 0 });
      void run(key);
    },
    [patchPending, run]
  );

  const discard = useCallback(
    (key: string) => {
      imagesRef.current.delete(key);
      setPending((current) => current.filter((entry) => entry.key !== key));
    },
    [setPending]
  );

  const canRemove = useCallback(
    (photoId: string) => photos.some((photo) => photo.id === photoId) && canRemovePhoto(photos.length, mode),
    [mode, photos]
  );

  const remove = useCallback(
    async (photoId: string) => {
      if (!canRemovePhoto(photosRef.current.length, mode)) {
        setNotice({
          message: `Necesitas al menos ${MIN_PROFILE_PHOTOS} fotos. Sube otra antes de quitar esta.`
        });
        return false;
      }

      setBusyPhotoId(photoId);
      setNotice(null);

      try {
        await api.deletePhoto(photoId);
        setPhotos((current) => current.filter((photo) => photo.id !== photoId));
        return true;
      } catch (error) {
        setNotice({ message: friendlyErrorMessage(error, "No hemos podido quitar la foto. Inténtalo otra vez.") });
        return false;
      } finally {
        if (mountedRef.current) {
          setBusyPhotoId(null);
        }
      }
    },
    [api, mode, setPhotos]
  );

  const makeMain = useCallback(
    async (photoId: string) => {
      const order = orderWithMainFirst(photosRef.current, photoId);

      if (!order) {
        return false;
      }

      if (pendingRef.current.some((entry) => entry.error === null)) {
        setNotice({ message: "Espera a que terminen de subirse las fotos para cambiar la principal." });
        return false;
      }

      const previous = photosRef.current;
      // Optimista: la polaroid salta a la primera posición al instante.
      setPhotos(() =>
        order.map((id, index) => {
          const photo = previous.find((entry) => entry.id === id)!;
          return { ...photo, position: index + 1 };
        })
      );
      setBusyPhotoId(photoId);
      setNotice(null);

      try {
        const saved = await api.reorderPhotos(order);
        setPhotos(() => saved);
        return true;
      } catch (error) {
        setPhotos(() => previous);
        setNotice({ message: friendlyErrorMessage(error, "No hemos podido cambiar la foto principal. Inténtalo otra vez.") });
        return false;
      } finally {
        if (mountedRef.current) {
          setBusyPhotoId(null);
        }
      }
    },
    [api, setPhotos]
  );

  const reload = useCallback(async () => {
    const fresh = await api.listPhotos();
    setPhotos(() => fresh);
  }, [api, setPhotos]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const slots = useMemo(() => buildPhotoSlots(photos, pending), [pending, photos]);
  const uploading = pending.some((entry) => entry.error === null);
  const remaining = remainingPhotoSlots(photos.length, pending.length);

  return {
    photos,
    pending,
    slots,
    uploadedCount: photos.length,
    uploading,
    remaining,
    canAdd: remaining > 0,
    canContinue: photos.length >= MIN_PROFILE_PHOTOS && !uploading,
    busyPhotoId,
    notice,
    clearNotice,
    add,
    addImages,
    retry,
    discard,
    canRemove,
    remove,
    makeMain,
    reload
  };
}
