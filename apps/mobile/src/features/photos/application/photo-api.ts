import type { ProfileApi } from "@cherry/mobile-shared";

import type { PhotoManagerApi } from "./use-photo-manager";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

/**
 * Adapta `callApi` de `useAuthedApi(createProfileApi)` (token fresco y reintento
 * ante 401 en cada llamada) a la interfaz que usan el gestor de fotos y el
 * pipeline de subida.
 */
export function bindPhotoApi(callApi: CallProfileApi): PhotoManagerApi {
  return {
    listPhotos: () => callApi((api) => api.listPhotos()),
    createPhotoUploadIntent: (request) => callApi((api) => api.createPhotoUploadIntent(request)),
    completePhotoUpload: (request) => callApi((api) => api.completePhotoUpload(request)),
    deletePhoto: (photoId) => callApi((api) => api.deletePhoto(photoId)),
    reorderPhotos: (photoIds) => callApi((api) => api.reorderPhotos(photoIds))
  };
}
