import { useMemo } from "react";

import type { ProfilePhoto } from "@snack/contracts";
import type { ProfileApi } from "@snack/mobile-shared";

import { bindPhotoApi } from "../application/photo-api";
import { usePhotoManager } from "../application/use-photo-manager";
import type { PhotoManagerMode } from "../domain/photo-slots";
import { compressWithManipulator } from "../infrastructure/image-compressor";
import { pickPhotos } from "../infrastructure/image-picker";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

/** Gestor de fotos conectado a la API autenticada, al selector y al compresor reales. */
export function useProfilePhotoManager({
  callApi,
  mode,
  initialPhotos,
  onPhotosChange
}: {
  callApi: CallProfileApi;
  mode: PhotoManagerMode;
  initialPhotos: ReadonlyArray<ProfilePhoto>;
  onPhotosChange?: (photos: ProfilePhoto[]) => void;
}) {
  const api = useMemo(() => bindPhotoApi(callApi), [callApi]);

  return usePhotoManager({
    api,
    mode,
    initialPhotos,
    pick: pickPhotos,
    compress: compressWithManipulator,
    onPhotosChange
  });
}
