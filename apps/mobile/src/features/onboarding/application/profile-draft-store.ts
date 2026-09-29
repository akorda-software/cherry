import { create } from "zustand";

import type { DiscoveryPreferences, Profile, ProfilePhoto, Tag } from "@snack/contracts";
import type { ProfileApi } from "@snack/mobile-shared";

/**
 * Borrador del perfil propio compartido por los pasos del onboarding y las
 * pantallas de edición: se carga una vez (`GET /api/me/profile`) y cada guardado
 * lo actualiza con la respuesta del backend. Así ir adelante y atrás es
 * instantáneo (nada de spinners entre preguntas). El catálogo de etiquetas se
 * precarga en paralelo para que el paso de etiquetas aparezca ya lleno.
 */
type LoadStatus = "idle" | "loading" | "ready" | "error";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

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

export const useProfileDraftStore = create<ProfileDraftState>((set) => ({
  ...INITIAL,

  setProfile: (profile) => set({ profile, status: "ready", error: null }),

  patchProfile: (patch) => set((state) => (state.profile ? { profile: { ...state.profile, ...patch } } : state)),

  setPhotos: (photos) =>
    set((state) => (state.profile ? { profile: { ...state.profile, photos } } : state)),

  setPreferences: (discoveryPreferences) =>
    set((state) => (state.profile ? { profile: { ...state.profile, discoveryPreferences } } : state)),

  setTags: ({ tags, blockedTags }) =>
    set((state) =>
      state.profile
        ? {
            profile: {
              ...state.profile,
              ...(tags ? { tags } : null),
              ...(blockedTags ? { blockedTags } : null)
            }
          }
        : state
    ),

  setCatalog: (catalog) => set({ catalog, catalogStatus: "ready" }),

  reset: () => set({ ...INITIAL })
}));

let profileRequest: { userId: string; promise: Promise<Profile | null> } | null = null;
let catalogRequest: Promise<Tag[]> | null = null;

/**
 * Carga (o reutiliza) el perfil del usuario. `force` vuelve a pedirlo aunque
 * ya esté cargado. Devuelve el perfil (`null` = aún no existe).
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
    profileRequest = null;
    catalogRequest = null;
  } else if (!force && store.status === "ready") {
    return store.profile;
  }

  if (profileRequest && profileRequest.userId === userId && !force) {
    return profileRequest.promise;
  }

  useProfileDraftStore.setState({ status: "loading", error: null });

  const promise = callApi((api) => api.getProfile()).then(
    ({ profile }) => {
      if (useProfileDraftStore.getState().userId === userId) {
        useProfileDraftStore.setState({ profile, status: "ready", error: null });
      }
      return profile;
    },
    (error: unknown) => {
      if (useProfileDraftStore.getState().userId === userId) {
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

  if (!catalogRequest || force) {
    useProfileDraftStore.setState({ catalogStatus: "loading" });
    catalogRequest = callApi((api) => api.getTagCatalog()).then(
      (catalog) => {
        useProfileDraftStore.getState().setCatalog(catalog);
        return catalog;
      },
      (error: unknown) => {
        useProfileDraftStore.setState({ catalogStatus: "error" });
        catalogRequest = null;
        throw error;
      }
    );
  }

  return catalogRequest;
}
