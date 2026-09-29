import { create } from "zustand";

import type { Profile } from "@snack/contracts";
import { onSignOut } from "../../auth/presentation/on-sign-out";

interface OwnPhotoState {
  ownerId: string | null;
  url: string | null;
  displayName: string | null;
  status: "idle" | "loading" | "ready" | "error";
  /** Pide `GET /api/me/profile` (vía `load`) si no es de este usuario o está caducada. */
  refresh(ownerId: string | null, load: () => Promise<Profile | null>): Promise<void>;
}

let generation = 0;

/** Foto principal propia (la polaroid de la izquierda en la celebración de match). */
export const useOwnPhotoStore = create<OwnPhotoState>((set, get) => ({
  ownerId: null,
  url: null,
  displayName: null,
  status: "idle",

  async refresh(ownerId, load) {
    if (ownerId === null) {
      generation += 1;
      set({ ownerId: null, url: null, displayName: null, status: "idle" });
      return;
    }

    generation += 1;
    const gen = generation;
    const sameOwner = get().ownerId === ownerId;
    set({
      ownerId,
      status: "loading",
      ...(sameOwner ? {} : { url: null, displayName: null })
    });

    try {
      const profile = await load();

      if (gen !== generation) {
        return;
      }

      const photos = [...(profile?.photos ?? [])]
        .filter((photo) => photo.isActive !== false)
        .sort((a, b) => a.position - b.position);

      set({ url: photos[0]?.url ?? null, displayName: profile?.displayName ?? null, status: "ready" });
    } catch {
      if (gen === generation) {
        set({ status: "error" });
      }
    }
  }
}));

onSignOut(() => useOwnPhotoStore.setState({ ownerId: null, url: null, displayName: null, status: "idle" }));
