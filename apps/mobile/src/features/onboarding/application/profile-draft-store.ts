import { create } from "zustand";

import type { DiscoveryPreferences, Profile, ProfilePhoto, Tag } from "@cherry/contracts";
import type { ProfileApi } from "@cherry/mobile-shared";
import { onSignOut } from "../../auth/presentation/on-sign-out";

/**
 * Borrador del perfil propio compartido por los pasos del onboarding y las
 * pantallas de edición: se carga una vez (`GET /api/me/profile`) y cada guardado
 * lo actualiza con la respuesta del backend. Así ir adelante y atrás es
 * instantáneo (nada de spinners entre preguntas). El catálogo de etiquetas se
 * precarga en paralelo para que el paso de etiquetas aparezca ya lleno.
 */
type LoadStatus = "idle" | "loading" | "ready" | "error";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

/** Start eagerly, but normalize synchronous client errors into rejected promises. */
async function requestProfileApi<T>(callApi: CallProfileApi, run: (api: ProfileApi) => Promise<T>): Promise<T> {
  return callApi(run);
}

interface ProfileDraftState {
  /** Usuario al que pertenece el borrador (se descarta si cambia la sesión). */
  userId: string | null;
  status: LoadStatus;
  profile: Profile | null;
  error: unknown;
  catalog: Tag[] | null;
  catalogStatus: LoadStatus;

  setProfile(profile: Profile | null): void;
  patchProfile(patch: Partial<Profile>): void;
  setPhotos(photos: ProfilePhoto[]): void;
  setPreferences(preferences: DiscoveryPreferences): void;
  setTags(patch: { tags?: Tag[]; blockedTags?: Tag[] }): void;
  setCatalog(catalog: Tag[]): void;
  reset(): void;
}

const INITIAL = {
  userId: null,
  status: "idle" as LoadStatus,
  profile: null,
  error: null,
  catalog: null,
  catalogStatus: "idle" as LoadStatus
};

let profileRequest: { userId: string; promise: Promise<Profile | null> } | null = null;
let catalogRequest: Promise<Tag[]> | null = null;

/** A successful save is newer than any GET already in flight. */
function patchDraft(state: ProfileDraftState, patch: Partial<Profile>) {
  if (!state.profile) return state;
  profileRequest = null;
  return { profile: { ...state.profile, ...patch }, status: "ready" as const, error: null };
}

export const useProfileDraftStore = create<ProfileDraftState>((set) => ({
  ...INITIAL,

  setProfile: (profile) => {
    profileRequest = null;
    set({ profile, status: "ready", error: null });
  },

  patchProfile: (patch) => set((state) => patchDraft(state, patch)),

  setPhotos: (photos) => set((state) => patchDraft(state, { photos })),

  setPreferences: (discoveryPreferences) => set((state) => patchDraft(state, { discoveryPreferences })),

  setTags: ({ tags, blockedTags }) =>
    set((state) => patchDraft(state, { ...(tags ? { tags } : null), ...(blockedTags ? { blockedTags } : null) })),

  setCatalog: (catalog) => set({ catalog, catalogStatus: "ready" }),

  reset: () => {
    profileRequest = null;
    catalogRequest = null;
    set({ ...INITIAL });
  }
}));

/**
 * Carga (o reutiliza) el perfil del usuario. `force` vuelve a pedirlo aunque
 * ya esté cargado, pero comparte cualquier petición pendiente para ese usuario.
 * Devuelve el perfil (`null` = aún no existe).
 */
export async function loadProfileDraft(
  callApi: CallProfileApi,
  userId: string,
  { force = false }: { force?: boolean } = {}
): Promise<Profile | null> {
  const store = useProfileDraftStore.getState();

  if (store.userId !== userId) {
    store.reset();
    useProfileDraftStore.setState({ userId });
  } else if (!force && store.status === "ready") {
    return store.profile;
  }

  if (profileRequest && profileRequest.userId === userId) {
    return profileRequest.promise;
  }

  useProfileDraftStore.setState({ status: "loading", error: null });

  const promise = requestProfileApi(callApi, (api) => api.getProfile()).then(
    ({ profile }) => {
      if (profileRequest?.promise === promise && useProfileDraftStore.getState().userId === userId) {
        useProfileDraftStore.setState({ profile, status: "ready", error: null });
      }
      return profile;
    },
    (error: unknown) => {
      if (profileRequest?.promise === promise && useProfileDraftStore.getState().userId === userId) {
        useProfileDraftStore.setState({ status: "error", error });
      }
      throw error;
    }
  );

  profileRequest = { userId, promise };

  try {
    return await promise;
  } finally {
    if (profileRequest?.promise === promise) {
      profileRequest = null;
    }
  }
}

/** Catálogo de etiquetas (se pide una vez por sesión de app). */
export async function loadTagCatalog(callApi: CallProfileApi, { force = false }: { force?: boolean } = {}): Promise<Tag[]> {
  const store = useProfileDraftStore.getState();

  if (!force && store.catalog) {
    return store.catalog;
  }

  if (catalogRequest) return catalogRequest;

  useProfileDraftStore.setState({ catalogStatus: "loading" });
  const promise = requestProfileApi(callApi, (api) => api.getTagCatalog()).then(
    (catalog) => {
      if (catalogRequest === promise) {
        useProfileDraftStore.getState().setCatalog(catalog);
      }
      return catalog;
    },
    (error: unknown) => {
      if (catalogRequest === promise) {
        useProfileDraftStore.setState({ catalogStatus: "error" });
      }
      throw error;
    }
  );
  catalogRequest = promise;

  try {
    return await promise;
  } finally {
    if (catalogRequest === promise) catalogRequest = null;
  }
}

// El borrador contiene el perfil entero: fuera de memoria al cerrar sesión.
onSignOut(() => {
  useProfileDraftStore.getState().reset();
});
