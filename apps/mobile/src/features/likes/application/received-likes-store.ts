import { create } from "zustand";

import type {
  DiscoveryActionRequest,
  DiscoveryActionResponse,
  DiscoveryActionType,
  DiscoveryMatch,
  DiscoveryUndoResponse,
  ReceivedLike,
  ReceivedLikesPage
} from "@cherry/contracts";

import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { onSignOut } from "../../auth/presentation/on-sign-out";

/**
 * Pestaña Likes: quién te ha dado like (gratis y visible). Paginación por cursor y respuestas
 * optimistas: ♥ = match al instante; ✕ = fuera, con «deshacer» unos segundos.
 */

export interface ReceivedLikesDeps {
  fetchPage(cursor: string | null): Promise<ReceivedLikesPage>;
  recordAction(request: DiscoveryActionRequest): Promise<DiscoveryActionResponse>;
  undo(): Promise<DiscoveryUndoResponse>;
  /** Hay match: celebración, lista de chats… */
  onMatch?(match: DiscoveryMatch): void;
  /** Cambio optimista del recuento de likes pendientes (badge). */
  onCountDelta?(delta: number): void;
}

export type ReceivedLikesStatus = "idle" | "loading" | "ready" | "error";

export interface LikesNotice {
  id: number;
  tone: "error" | "info";
  message: string;
}

export interface LastPass {
  like: ReceivedLike;
  index: number;
  at: number;
}

export type RespondResult =
  | { kind: "match"; match: DiscoveryMatch }
  | { kind: "done" }
  | { kind: "gone" }
  | { kind: "failed"; error: unknown }
  | { kind: "ignored" };

export interface ReceivedLikesState {
  likes: ReceivedLike[];
  status: ReceivedLikesStatus;
  error: unknown;
  refreshing: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
  hasMore: boolean;
  /** Respuestas en vuelo por perfil. */
  pending: Readonly<Record<string, DiscoveryActionType>>;
  /** Último «no» (para el toast de deshacer). */
  lastPass: LastPass | null;
  undoing: boolean;
  notice: LikesNotice | null;

  load(deps: ReceivedLikesDeps, mode?: "initial" | "refresh" | "silent"): Promise<void>;
  loadMore(deps: ReceivedLikesDeps): Promise<void>;
  respond(deps: ReceivedLikesDeps, profileId: string, action: DiscoveryActionType): Promise<RespondResult>;
  undoPass(deps: ReceivedLikesDeps): Promise<boolean>;
  dismissUndo(): void;
  dismissNotice(): void;
  /** Alguien respondió a este like desde otra pantalla (perfil, descubrir). */
  removeProfile(profileId: string): void;
  reset(): void;
}

let loadInFlight: Promise<void> | null = null;
let generation = 0;
let paginationEpoch = 0;
let noticeId = 0;
const actionsInFlight = new Map<string, Promise<unknown>>();
// Only retain removals for reads that could contain an older server snapshot.
const readExclusions = new Set<Set<string>>();

async function fetchLikesPage(deps: ReceivedLikesDeps, cursor: string | null) {
  return deps.fetchPage(cursor);
}

function excludeFromReads(profileId: string) {
  for (const exclusions of readExclusions) exclusions.add(profileId);
}

function allowInReads(profileId: string) {
  for (const exclusions of readExclusions) exclusions.delete(profileId);
}

function notice(tone: LikesNotice["tone"], message: string): LikesNotice {
  noticeId += 1;
  return { id: noticeId, tone, message };
}

function appendUnique(current: ReceivedLike[], next: ReceivedLike[]): ReceivedLike[] {
  const seen = new Set(current.map((like) => like.profile.id));
  const additions = next.filter((like) => {
    if (seen.has(like.profile.id)) {
      return false;
    }
    seen.add(like.profile.id);
    return true;
  });
  return additions.length === 0 ? current : [...current, ...additions];
}

function insertAt(list: ReceivedLike[], like: ReceivedLike, index: number): ReceivedLike[] {
  if (list.some((entry) => entry.profile.id === like.profile.id)) {
    return list;
  }

  const position = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, position), like, ...list.slice(position)];
}

const initialState = {
  likes: [] as ReceivedLike[],
  status: "idle" as ReceivedLikesStatus,
  error: null as unknown,
  refreshing: false,
  loadingMore: false,
  nextCursor: null as string | null,
  hasMore: false,
  pending: {} as Readonly<Record<string, DiscoveryActionType>>,
  lastPass: null as LastPass | null,
  undoing: false,
  notice: null as LikesNotice | null
};

export const useReceivedLikesStore = create<ReceivedLikesState>((set, get) => {
  /** Quita de una página a quien ya he respondido (respuesta en vuelo o último «no»). */
  function withoutAnswered(likes: ReceivedLike[], excluded: ReadonlySet<string>): ReceivedLike[] {
    const { pending, lastPass } = get();
    return likes.filter(
      (like) => !excluded.has(like.profile.id) && pending[like.profile.id] === undefined && lastPass?.like.profile.id !== like.profile.id
    );
  }

  function trackRead() {
    const excluded = new Set(Object.keys(get().pending));
    readExclusions.add(excluded);
    return excluded;
  }

  function clearPending(profileId: string) {
    const { [profileId]: _removed, ...rest } = get().pending;
    set({ pending: rest });
  }

  return {
    ...initialState,

    load(deps, mode = "initial") {
      const { status } = get();

      if (mode === "refresh") {
        set({ refreshing: true });
      } else if (mode === "initial" && (status === "idle" || status === "error")) {
        set({ status: "loading", error: null });
      }

      if (loadInFlight) {
        return loadInFlight;
      }

      const loadGeneration = generation;
      paginationEpoch += 1;
      const excluded = trackRead();
      set({ loadingMore: false });

      const request = fetchLikesPage(deps, null)
        .then(
          (page) => {
            if (loadGeneration !== generation) {
              return;
            }

            set({
              likes: withoutAnswered(appendUnique([], page.likes), excluded),
              nextCursor: page.nextCursor,
              hasMore: page.nextCursor !== null,
              status: "ready",
              error: null
            });
          },
          (error: unknown) => {
            if (loadGeneration !== generation) {
              return;
            }

            if (get().status === "ready") {
              set({
                error,
                notice: mode === "refresh" ? notice("error", friendlyErrorMessage(error)) : get().notice
              });
            } else {
              set({ status: "error", error });
            }
          }
        )
        .finally(() => {
          if (loadGeneration === generation) {
            set({ refreshing: false });
          }
          readExclusions.delete(excluded);
          if (loadInFlight === request) loadInFlight = null;
        });

      loadInFlight = request;
      return request;
    },

    async loadMore(deps) {
      const { hasMore, loadingMore, status, nextCursor } = get();

      if (!hasMore || loadingMore || status !== "ready" || loadInFlight || nextCursor === null) {
        return;
      }

      const loadGeneration = generation;
      const pageEpoch = paginationEpoch;
      const excluded = trackRead();
      const current = () => loadGeneration === generation && pageEpoch === paginationEpoch;
      set({ loadingMore: true });

      try {
        const page = await fetchLikesPage(deps, nextCursor);
        if (!current()) {
          return;
        }

        set({
          likes: appendUnique(get().likes, withoutAnswered(page.likes, excluded)),
          nextCursor: page.nextCursor,
          hasMore: page.nextCursor !== null
        });
      } catch (error) {
        if (!current()) {
          return;
        }

        if (apiErrorCode(error) === "invalid_cursor") {
          // El cursor caduca (24 h): empezamos de nuevo sin cursor.
          set({ loadingMore: false });
          await get().load(deps, "silent");
        }
        // Otros errores: se reintenta al volver a llegar al final.
      } finally {
        readExclusions.delete(excluded);
        if (current()) {
          set({ loadingMore: false });
        }
      }
    },

    async respond(deps, profileId, action) {
      const { likes, pending } = get();
      const index = likes.findIndex((like) => like.profile.id === profileId);

      if (index < 0 || pending[profileId] !== undefined) {
        return { kind: "ignored" };
      }

      const entry = likes[index]!;
      const respondGeneration = generation;
      excludeFromReads(profileId);
      set({
        likes: likes.filter((like) => like.profile.id !== profileId),
        pending: { ...pending, [profileId]: action },
        // Deshacer solo sirve para el último «no»: cualquier otra respuesta lo invalida.
        lastPass: action === "dislike" ? { like: entry, index, at: Date.now() } : null
      });
      deps.onCountDelta?.(-1);

      let request: Promise<DiscoveryActionResponse>;

      try {
        request = deps.recordAction({ targetProfileId: profileId, actionType: action });
      } catch (error) {
        // Un fallo síncrono se trata igual que uno de red: rollback y aviso.
        request = Promise.reject(error);
      }

      actionsInFlight.set(profileId, request);

      try {
        const response = await request;

        if (respondGeneration !== generation) {
          // La sesión cambió (o se vació la bandeja) mientras viajaba: nada de esto es ya nuestro.
          return { kind: "ignored" };
        }

        clearPending(profileId);

        if (response.matchCreated) {
          deps.onMatch?.(response.match);
          return { kind: "match", match: response.match };
        }

        return { kind: "done" };
      } catch (error) {
        if (respondGeneration !== generation) {
          return { kind: "ignored" };
        }

        clearPending(profileId);
        const code = apiErrorCode(error);

        if (code === "already_swiped") {
          // Ya respondido (otro dispositivo, otra pantalla): se queda fuera.
          return { kind: "done" };
        }

        if (get().lastPass?.like.profile.id === profileId) {
          set({ lastPass: null });
        }

        if (code === "profile_not_found") {
          set({ notice: notice("info", "Este perfil ya no está disponible.") });
          return { kind: "gone" };
        }

        allowInReads(profileId);
        set({
          likes: insertAt(get().likes, entry, index),
          notice: notice(
            "error",
            apiErrorCode(error) === "profile_paused"
              ? "Tu perfil está en pausa. Reanúdalo en Yo para responder a los likes."
              : friendlyErrorMessage(error, "No hemos podido guardar tu respuesta. Inténtalo otra vez.")
          )
        });
        deps.onCountDelta?.(1);
        return { kind: "failed", error };
      } finally {
        if (actionsInFlight.get(profileId) === request) {
          actionsInFlight.delete(profileId);
        }
      }
    },

    async undoPass(deps) {
      const { lastPass, undoing } = get();

      if (!lastPass || undoing) {
        return false;
      }

      const profileId = lastPass.like.profile.id;
      const undoGeneration = generation;
      set({ undoing: true });

      try {
        // Si el «no» aún viaja, esperamos a que llegue antes de deshacerlo.
        await actionsInFlight.get(profileId)?.catch(() => undefined);

        if (undoGeneration !== generation || get().lastPass !== lastPass) {
          // Falló o se invalidó mientras tanto: no hay nada que deshacer.
          return false;
        }

        const response = await deps.undo();

        if (undoGeneration !== generation) {
          return false;
        }

        // El backend puede deshacer y responder `profile: null` si esa persona ya no es visible.
        const undoneProfile = (response as { profile: DiscoveryUndoResponse["profile"] | null }).profile;

        if (!undoneProfile) {
          set({ lastPass: null, notice: notice("info", "Deshecho, pero esa persona ya no está disponible.") });
          return true;
        }

        if (undoneProfile.id === profileId) {
          allowInReads(profileId);
          set({ likes: insertAt(get().likes, lastPass.like, lastPass.index) });
          deps.onCountDelta?.(1);
        }

        set({ lastPass: null });
        return true;
      } catch (error) {
        if (undoGeneration !== generation) {
          return false;
        }

        set({
          lastPass: null,
          notice:
            apiErrorCode(error) === "nothing_to_undo"
              ? notice("info", "Ya no se puede deshacer.")
              : notice("error", friendlyErrorMessage(error, "No hemos podido deshacerlo. Inténtalo otra vez."))
        });
        return false;
      } finally {
        if (undoGeneration === generation) set({ undoing: false });
      }
    },

    dismissUndo() {
      if (get().lastPass !== null && !get().undoing) {
        set({ lastPass: null });
      }
    },

    dismissNotice() {
      if (get().notice !== null) {
        set({ notice: null });
      }
    },

    removeProfile(profileId) {
      excludeFromReads(profileId);
      const { likes } = get();
      if (likes.some((like) => like.profile.id === profileId)) {
        set({ likes: likes.filter((like) => like.profile.id !== profileId) });
      }
    },

    reset() {
      generation += 1;
      paginationEpoch += 1;
      loadInFlight = null;
      actionsInFlight.clear();
      readExclusions.clear();
      set({ ...initialState });
    }
  };
});

onSignOut(() => useReceivedLikesStore.getState().reset());
