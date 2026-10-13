import { createStore, type StoreApi } from "zustand/vanilla";

import {
  createDiscoveryProfileCard,
  type DiscoveryActionRequest,
  type DiscoveryActionResponse,
  type DiscoveryActionType,
  type DiscoveryFeedPage,
  type DiscoveryMatch,
  type DiscoveryProfileCard,
  type DiscoveryUndoResponse,
  type OnboardingStep
} from "@cherry/contracts";

import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { classifyActionError, classifyFeedError } from "../domain/feed-errors";

/** Tamaño de página del feed. */
export const DISCOVERY_PAGE_SIZE = 20;
/** Cuando quedan estas cards o menos, se pide la siguiente página. */
export const DISCOVERY_PREFETCH_THRESHOLD = 5;
/** Cuántas cards por delante se precargan (todas las fotos de las 2 primeras, la principal del resto). */
export const DISCOVERY_IMAGE_LOOKAHEAD = 6;

export interface DiscoveryQueueDeps {
  fetchPage(cursor: string | null): Promise<DiscoveryFeedPage>;
  recordAction(request: DiscoveryActionRequest): Promise<DiscoveryActionResponse>;
  undo(): Promise<DiscoveryUndoResponse>;
  /** Precarga imágenes (expo-image `Image.prefetch`). Nunca debe lanzar. */
  prefetchImages?(urls: string[]): void;
  /** Se llama cuando un like crea match (la celebración la pinta `MatchCelebrationHost`). */
  onMatch?(match: DiscoveryMatch): void;
}

export type DiscoveryQueueStatus = "idle" | "loading" | "ready" | "error" | "paused" | "incomplete";

export type DiscoveryQueueNotice =
  | { id: number; kind: "action_failed"; message: string; profileId: string }
  | { id: number; kind: "nothing_to_undo"; message: string }
  | { id: number; kind: "undo_unavailable"; message: string }
  | { id: number; kind: "undo_failed"; message: string };

/** Una card que vuelve a la cabeza de la cola (deshacer o fallo al guardar). */
export interface DiscoveryQueueReturn {
  seq: number;
  profileId: string;
  reason: "undo" | "rollback";
  /** Acción que se ha revertido: la animación de vuelta entra por ese lado. */
  action: DiscoveryActionType;
}

/** Última salida de la cola (sirve para animar salidas que no nacen de un gesto). */
export interface DiscoveryQueueRemoval {
  seq: number;
  profileId: string;
  card: DiscoveryProfileCard;
  action: DiscoveryActionType | null;
  index: number;
}

export interface DiscoveryQueueState {
  /** Dueño de la cola (id de usuario): si cambia la sesión, la cola se vacía. */
  ownerId: string | null;
  status: DiscoveryQueueStatus;
  /** Cards pendientes de decidir, en el orden del feed. */
  profiles: DiscoveryProfileCard[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  /** Mensaje amable cuando `status === "error"`. */
  error: string | null;
  nextOnboardingStep: OnboardingStep | null;
  /** Acciones en vuelo por id de perfil. */
  pending: Record<string, DiscoveryActionType>;
  /** Último «no» confirmado localmente: permite un deshacer instantáneo. */
  lastPass: DiscoveryProfileCard | null;
  /**
   * Si tiene sentido ofrecer ↺. Se apaga al recargar por cambio de filtros (el último «no»
   * puede no cumplirlos) y se vuelve a encender con la siguiente decisión.
   */
  canUndo: boolean;
  undoing: boolean;
  notice: DiscoveryQueueNotice | null;
  lastReturn: DiscoveryQueueReturn | null;
  lastRemoval: DiscoveryQueueRemoval | null;
}

export type DiscoveryActResult =
  | { status: "recorded"; response: DiscoveryActionResponse }
  | { status: "settled" }
  | { status: "rolled_back"; error: unknown }
  | { status: "ignored" };

export type DiscoveryUndoResult =
  | { status: "undone"; card: DiscoveryProfileCard }
  /** El backend lo deshizo, pero esa persona ya no es visible (`profile: null`). */
  | { status: "unavailable" }
  | { status: "nothing_to_undo" }
  | { status: "failed"; error: unknown }
  | { status: "busy" };

export interface DiscoveryQueueActions {
  /** Liga la cola a un usuario; si es otro distinto, la vacía. */
  bind(ownerId: string | null): void;
  /**
   * Carga (o recarga) la primera página. Con `filtersChanged`, además olvida el último «no»
   * y desactiva ↺ hasta la siguiente decisión: deshacer reinsertaría a alguien fuera de los filtros.
   */
  load(options?: DiscoveryLoadOptions): Promise<void>;
  /** Siguiente página (no hace nada si ya se está pidiendo o no hay más). */
  loadMore(): Promise<void>;
  /** Like/dislike optimista: sale de la cola al instante y vuelve si falla la red. */
  act(card: DiscoveryProfileCard, action: DiscoveryActionType): Promise<DiscoveryActResult>;
  /** Deshace el último «no» (gratis). Instantáneo si lo conocemos; si no, pregunta al backend. */
  undo(): Promise<DiscoveryUndoResult>;
  /** Quita a alguien de la cola sin registrar acción (bloqueo, reporte, acción desde otra pestaña). */
  remove(profileId: string): void;
  dismissNotice(id?: number): void;
  reset(): void;
}

export interface DiscoveryLoadOptions {
  filtersChanged?: boolean;
}

export type DiscoveryQueueStore = DiscoveryQueueState & DiscoveryQueueActions;

/** Respuesta de deshacer tal y como puede llegar: el backend responde `profile: null` si ya no es visible. */
type UndoPayload = Omit<DiscoveryUndoResponse, "profile"> & { profile: DiscoveryUndoResponse["profile"] | null };

const INITIAL_STATE: DiscoveryQueueState = {
  ownerId: null,
  status: "idle",
  profiles: [],
  hasMore: true,
  loadingMore: false,
  loadMoreFailed: false,
  error: null,
  nextOnboardingStep: null,
  pending: {},
  lastPass: null,
  canUndo: true,
  undoing: false,
  notice: null,
  lastReturn: null,
  lastRemoval: null
};

const MAX_EMPTY_PAGES_IN_A_ROW = 3;

export function createDiscoveryQueue(
  depsSource: DiscoveryQueueDeps | (() => DiscoveryQueueDeps | null)
): StoreApi<DiscoveryQueueStore> {
  const resolveDeps = (): DiscoveryQueueDeps => {
    const deps = typeof depsSource === "function" ? depsSource() : depsSource;

    if (!deps) {
      throw new Error("Discovery queue used before its API was configured");
    }

    return deps;
  };

  let cursor: string | null = null;
  let generation = 0;
  /** Solo cambia con `reset()` (cambio de sesión): distingue «otra carga» de «otra persona». */
  let session = 0;
  let seq = 0;
  let emptyPagesInARow = 0;
  /** Perfiles decididos en esta sesión: nunca se vuelven a meter desde una página posterior. */
  const decided = new Set<string>();
  const inflight = new Map<string, Promise<unknown>>();
  const prefetched = new Set<string>();

  const nextSeq = () => {
    seq += 1;
    return seq;
  };

  return createStore<DiscoveryQueueStore>()((set, get) => {
    function prefetchUpcoming() {
      const deps = typeof depsSource === "function" ? depsSource() : depsSource;

      if (!deps?.prefetchImages) {
        return;
      }

      const urls: string[] = [];

      get()
        .profiles.slice(0, DISCOVERY_IMAGE_LOOKAHEAD)
        .forEach((card, index) => {
          const photos = card.photos.length > 0 ? card.photos.map((photo) => photo.url) : [card.photoUrl];
          const wanted = index < 2 ? photos : photos.slice(0, 1);

          for (const url of wanted) {
            if (typeof url === "string" && url !== "" && !prefetched.has(url)) {
              prefetched.add(url);
              urls.push(url);
            }
          }
        });

      if (urls.length > 0) {
        try {
          deps.prefetchImages(urls);
        } catch {
          // La precarga es una mejora: nunca rompe la cola.
        }
      }
    }

    function maybeLoadMore() {
      const state = get();

      if (
        state.status === "ready" &&
        state.hasMore &&
        !state.loadingMore &&
        !state.loadMoreFailed &&
        state.profiles.length <= DISCOVERY_PREFETCH_THRESHOLD &&
        emptyPagesInARow < MAX_EMPTY_PAGES_IN_A_ROW
      ) {
        void get().loadMore();
      }
    }

    function acceptable(cards: DiscoveryProfileCard[], existing: DiscoveryProfileCard[]) {
      const seen = new Set(existing.map((card) => card.id));
      const out: DiscoveryProfileCard[] = [];

      for (const raw of cards) {
        if (decided.has(raw.id) || seen.has(raw.id)) {
          continue;
        }

        seen.add(raw.id);
        out.push(createDiscoveryProfileCard(raw));
      }

      return out;
    }

    function applyBlockingFailure(error: unknown): boolean {
      const failure = classifyFeedError(error);

      if (failure.kind === "paused") {
        set({ status: "paused", loadingMore: false, profiles: [] });
        return true;
      }

      if (failure.kind === "incomplete") {
        set({
          status: "incomplete",
          loadingMore: false,
          profiles: [],
          nextOnboardingStep: failure.nextOnboardingStep
        });
        return true;
      }

      return false;
    }

    return {
      ...INITIAL_STATE,

      bind(ownerId) {
        if (get().ownerId === ownerId) {
          return;
        }

        get().reset();
        set({ ownerId });
      },

      async load(options) {
        generation += 1;
        const gen = generation;
        cursor = null;
        emptyPagesInARow = 0;

        set({
          ...(options?.filtersChanged ? { lastPass: null, canUndo: false } : null),
          status: "loading",
          profiles: [],
          hasMore: true,
          loadingMore: false,
          loadMoreFailed: false,
          error: null,
          nextOnboardingStep: null,
          lastReturn: null,
          lastRemoval: null
        });

        try {
          const page = await resolveDeps().fetchPage(null);

          if (gen !== generation) {
            return;
          }

          cursor = page.nextCursor;
          set({
            status: "ready",
            profiles: acceptable(page.profiles, []),
            hasMore: page.nextCursor !== null
          });
          prefetchUpcoming();
          maybeLoadMore();
        } catch (error) {
          if (gen !== generation) {
            return;
          }

          if (!applyBlockingFailure(error)) {
            const failure = classifyFeedError(error);
            set({
              status: "error",
              error:
                failure.kind === "error"
                  ? failure.message
                  : "No hemos podido traer perfiles ahora mismo. Inténtalo otra vez."
            });
          }
        }
      },

      async loadMore() {
        const state = get();

        if (state.status !== "ready" || state.loadingMore || !state.hasMore) {
          return;
        }

        const gen = generation;
        set({ loadingMore: true, loadMoreFailed: false });

        const fetchFrom = async (from: string | null, restarted: boolean): Promise<void> => {
          try {
            const page = await resolveDeps().fetchPage(from);

            if (gen !== generation) {
              return;
            }

            cursor = page.nextCursor;
            const additions = acceptable(page.profiles, get().profiles);
            emptyPagesInARow = additions.length === 0 ? emptyPagesInARow + 1 : 0;

            set({
              profiles: additions.length === 0 ? get().profiles : [...get().profiles, ...additions],
              hasMore: page.nextCursor !== null,
              loadingMore: false
            });
            prefetchUpcoming();
            maybeLoadMore();
          } catch (error) {
            if (gen !== generation) {
              return;
            }

            // Cursor caducado (validez de 1 h): se reinicia la paginación sin vaciar la pila.
            if (!restarted && classifyFeedError(error).kind === "invalid_cursor") {
              await fetchFrom(null, true);
              return;
            }

            if (!applyBlockingFailure(error)) {
              set({ loadingMore: false, loadMoreFailed: true });
            }
          }
        };

        await fetchFrom(cursor, false);
      },

      async act(card, action) {
        const state = get();

        if (state.pending[card.id] !== undefined) {
          return { status: "ignored" };
        }

        const index = state.profiles.findIndex((profile) => profile.id === card.id);
        const previousLastPass = state.lastPass;
        const previousCanUndo = state.canUndo;
        const gen = generation;
        const ses = session;
        decided.add(card.id);

        set({
          profiles: index === -1 ? state.profiles : state.profiles.filter((profile) => profile.id !== card.id),
          pending: { ...state.pending, [card.id]: action },
          // El backend solo deshace el ÚLTIMO swipe si fue un «no».
          lastPass: action === "dislike" ? card : null,
          canUndo: true,
          loadMoreFailed: false,
          lastRemoval: { seq: nextSeq(), profileId: card.id, card, action, index }
        });
        prefetchUpcoming();
        maybeLoadMore();

        const clearPending = () => {
          if (ses !== session) {
            return;
          }

          const { [card.id]: _removed, ...rest } = get().pending;
          set({ pending: rest });
        };

        let request: Promise<DiscoveryActionResponse>;

        try {
          request = resolveDeps().recordAction({ targetProfileId: card.id, actionType: action });
        } catch (error) {
          request = Promise.reject(error);
        }

        inflight.set(card.id, request);

        try {
          const response = await request;
          clearPending();

          // Un match que llega tras cambiar de sesión no es de quien está ahora en la app.
          if (response.matchCreated && ses === session) {
            resolveDeps().onMatch?.(response.match);
          }

          return { status: "recorded", response };
        } catch (error) {
          clearPending();

          if (classifyActionError(error) === "settled") {
            return { status: "settled" };
          }

          decided.delete(card.id);

          if (gen === generation) {
            const current = get();
            const stillOut = !current.profiles.some((profile) => profile.id === card.id);
            const at = index === -1 ? 0 : Math.min(index, current.profiles.length);

            set({
              profiles: stillOut
                ? [...current.profiles.slice(0, at), card, ...current.profiles.slice(at)]
                : current.profiles,
              lastPass: current.lastPass?.id === card.id ? previousLastPass : current.lastPass,
              canUndo: current.lastPass?.id === card.id ? previousCanUndo : current.canUndo,
              lastReturn: stillOut
                ? { seq: nextSeq(), profileId: card.id, reason: "rollback", action }
                : current.lastReturn,
              notice: {
                id: nextSeq(),
                kind: "action_failed",
                profileId: card.id,
                message: `${friendlyErrorMessage(error, "No hemos podido guardar tu decisión.")} ${card.displayName} vuelve a estar aquí.`
              }
            });
          }

          return { status: "rolled_back", error };
        } finally {
          if (inflight.get(card.id) === request) {
            inflight.delete(card.id);
          }
        }
      },

      async undo() {
        if (get().undoing) {
          return { status: "busy" };
        }

        if (!get().canUndo) {
          // Los filtros cambiaron desde el último «no»: ↺ está apagado hasta la siguiente decisión.
          return { status: "nothing_to_undo" };
        }

        set({ undoing: true });

        // Si el último «no» aún viaja, el backend todavía no lo conoce.
        if (inflight.size > 0) {
          await Promise.allSettled([...inflight.values()]);
        }

        const gen = generation;
        const optimistic = get().lastPass;

        if (optimistic) {
          decided.delete(optimistic.id);
          set({
            profiles: [optimistic, ...get().profiles.filter((profile) => profile.id !== optimistic.id)],
            lastPass: null,
            lastReturn: { seq: nextSeq(), profileId: optimistic.id, reason: "undo", action: "dislike" }
          });
        }

        const dropOptimistic = () => {
          if (!optimistic || gen !== generation) {
            return;
          }

          decided.add(optimistic.id);
          const index = get().profiles.findIndex((profile) => profile.id === optimistic.id);

          set({
            profiles: get().profiles.filter((profile) => profile.id !== optimistic.id),
            lastRemoval:
              index === -1
                ? get().lastRemoval
                : { seq: nextSeq(), profileId: optimistic.id, card: optimistic, action: "dislike", index }
          });
        };

        try {
          const response = (await resolveDeps().undo()) as UndoPayload;

          if (!response.profile) {
            // Deshecho en el servidor, pero esa persona ya no es visible: se va sin drama.
            dropOptimistic();
            set({
              undoing: false,
              lastPass: null,
              notice: {
                id: nextSeq(),
                kind: "undo_unavailable",
                message: "Deshecho, pero esa persona ya no está disponible."
              }
            });
            return { status: "unavailable" };
          }

          const card = createDiscoveryProfileCard(response.profile);
          decided.delete(card.id);

          if (gen === generation) {
            const current = get();
            const replacedOptimistic = optimistic !== null && optimistic.id !== card.id;

            if (replacedOptimistic) {
              decided.add(optimistic.id);
            }

            const rest = current.profiles.filter(
              (profile) => profile.id !== card.id && !(replacedOptimistic && profile.id === optimistic.id)
            );

            set({
              profiles: [card, ...rest],
              undoing: false,
              lastPass: null,
              lastReturn:
                optimistic?.id === card.id
                  ? current.lastReturn
                  : { seq: nextSeq(), profileId: card.id, reason: "undo", action: "dislike" }
            });
            prefetchUpcoming();
          } else {
            set({ undoing: false });
          }

          return { status: "undone", card };
        } catch (error) {
          dropOptimistic();

          const nothing = apiErrorCode(error) === "nothing_to_undo";

          set({
            undoing: false,
            notice: nothing
              ? {
                  id: nextSeq(),
                  kind: "nothing_to_undo",
                  message: "Nada que deshacer por aquí. Solo puedes recuperar tu último «no» durante 10 minutos."
                }
              : {
                  id: nextSeq(),
                  kind: "undo_failed",
                  message: friendlyErrorMessage(error, "No hemos podido deshacerlo. Inténtalo otra vez.")
                }
          });

          return nothing ? { status: "nothing_to_undo" } : { status: "failed", error };
        }
      },

      remove(profileId) {
        decided.add(profileId);
        const state = get();
        const index = state.profiles.findIndex((profile) => profile.id === profileId);

        if (index === -1) {
          return;
        }

        const card = state.profiles[index]!;

        set({
          profiles: state.profiles.filter((profile) => profile.id !== profileId),
          lastPass: state.lastPass?.id === profileId ? null : state.lastPass,
          lastRemoval: { seq: nextSeq(), profileId, card, action: null, index }
        });
        prefetchUpcoming();
        maybeLoadMore();
      },

      dismissNotice(id) {
        const notice = get().notice;

        if (notice && (id === undefined || notice.id === id)) {
          set({ notice: null });
        }
      },

      reset() {
        generation += 1;
        session += 1;
        cursor = null;
        emptyPagesInARow = 0;
        decided.clear();
        inflight.clear();
        prefetched.clear();
        set({ ...INITIAL_STATE });
      }
    };
  });
}
