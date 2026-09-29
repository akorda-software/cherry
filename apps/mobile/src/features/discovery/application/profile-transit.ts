import { create } from "zustand";

import type {
  DiscoveryActionResponse,
  DiscoveryActionType,
  DiscoveryProfileCard,
  PublicProfile
} from "@snack/contracts";
import { onSignOut } from "../../auth/presentation/on-sign-out";

/** Desde dónde se abrió el perfil completo (decide cómo se registra la acción). */
export type ProfileOrigin = "discover" | "likes" | "matches" | "chat" | "other";

export interface ProfileActionOutcome {
  action: DiscoveryActionType;
  /** `null` si el backend ya lo tenía (409) o la cola de Descubrir lo gestiona en segundo plano. */
  response: DiscoveryActionResponse | null;
}

export interface StagedProfile {
  /** Card o perfil que ya tenías: el perfil completo se pinta al instante con ella. */
  profile: DiscoveryProfileCard | PublicProfile;
  origin: ProfileOrigin;
  /** Tras un like/no desde el perfil completo (para actualizar tu lista de origen). */
  onAction?(outcome: ProfileActionOutcome): void;
  /** Tras bloquear o reportar desde el perfil completo. */
  onSafetyAction?(kind: "blocked" | "reported"): void;
  stagedAt: number;
}

export interface StageProfileOptions {
  origin?: ProfileOrigin;
  onAction?: StagedProfile["onAction"];
  onSafetyAction?: StagedProfile["onSafetyAction"];
}

interface ProfileTransitState {
  entries: Record<string, StagedProfile>;
  stage(profile: DiscoveryProfileCard | PublicProfile, options?: StageProfileOptions): void;
  release(profileId: string): void;
}

const MAX_ENTRIES = 24;

/**
 * «Card en tránsito»: guarda en memoria la card con la que se abre el perfil completo
 * para pintarlo al instante mientras llega `GET /api/profiles/:id`.
 */
export const useProfileTransitStore = create<ProfileTransitState>((set) => ({
  entries: {},

  stage(profile, options = {}) {
    set((state) => {
      const entries: Record<string, StagedProfile> = {
        ...state.entries,
        [profile.id]: {
          profile,
          origin: options.origin ?? "other",
          onAction: options.onAction,
          onSafetyAction: options.onSafetyAction,
          stagedAt: Date.now()
        }
      };
      const ids = Object.keys(entries);

      if (ids.length > MAX_ENTRIES) {
        ids
          .sort((a, b) => entries[a]!.stagedAt - entries[b]!.stagedAt)
          .slice(0, ids.length - MAX_ENTRIES)
          .forEach((id) => {
            delete entries[id];
          });
      }

      return { entries };
    });
  },

  release(profileId) {
    set((state) => {
      if (!(profileId in state.entries)) {
        return state;
      }

      const { [profileId]: _released, ...entries } = state.entries;
      return { entries };
    });
  }
}));

export function stageProfile(profile: DiscoveryProfileCard | PublicProfile, options?: StageProfileOptions) {
  useProfileTransitStore.getState().stage(profile, options);
}

export function getStagedProfile(profileId: string): StagedProfile | undefined {
  return useProfileTransitStore.getState().entries[profileId];
}

onSignOut(() => useProfileTransitStore.setState({ entries: {} }));
