import { create } from "zustand";

import type { ChatMessage, DiscoveryMatch, MatchesResponse, MatchSummary } from "@cherry/contracts";

import { onSignOut } from "../../auth/presentation/on-sign-out";
import { applyMessageToMatch, lastActivityAt, matchSummaryFromDiscoveryMatch, sortMatchesByActivity } from "../domain/match-list";

/**
 * Lista de matches compartida por la pestaña Chats, la conversación (cabecera, deshacer match)
 * y cualquier pantalla que cree un match. El chat la parchea en vivo (último mensaje, leído)
 * para que al volver a Chats todo esté al día sin esperar a la red.
 */

export type MatchesStatus = "idle" | "loading" | "ready" | "error";
export type MatchesLoadMode = "initial" | "refresh" | "silent";

export interface MatchesState {
  matches: MatchSummary[];
  status: MatchesStatus;
  /** Último error de carga (la carga inicial fallida deja `status: "error"`). */
  error: unknown;
  refreshing: boolean;
  lastLoadedAt: number | null;
  nextCursor: string | null;
  loadingMore: boolean;

  load(fetchMatches: () => Promise<MatchesResponse>, mode?: MatchesLoadMode): Promise<void>;
  loadMore(fetchPage: (cursor: string) => Promise<MatchesResponse>): Promise<void>;
  upsertFetchedMatch(match: MatchSummary): void;
  /** Match recién creado (like mutuo): aparece en «Nuevos matches» al instante. */
  addFromDiscoveryMatch(match: DiscoveryMatch): void;
  applyMessage(conversationId: string, message: ChatMessage, options: { read: boolean }): void;
  markRead(conversationId: string): void;
  /** Tras deshacer el match o bloquear. */
  removeMatch(matchId: string): void;
  reset(): void;
}

let inFlight: Promise<void> | null = null;
let pageInFlight: Promise<void> | null = null;
let generation = 0;
let sessionEpoch = 0;

/** Guards requests that may outlive sign-out without tying them to list refreshes. */
export function getMatchesSessionEpoch(): number {
  return sessionEpoch;
}
/** Matches quitados en local mientras una carga estaba en vuelo (no deben reaparecer). */
const removedIds = new Set<string>();

function timeOf(iso: string | undefined): number {
  const time = iso ? Date.parse(iso) : 0;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * La respuesta de esta página manda sobre sus entradas; si en local hay un
 * mensaje más reciente (enviado o recibido durante la petición), se conserva.
 */
export function mergeServerMatches(server: MatchSummary[], local: MatchSummary[]): MatchSummary[] {
  const localById = new Map(local.map((match) => [match.id, match]));

  return sortMatchesByActivity(
    server
      .filter((match) => !removedIds.has(match.id))
      .map((match) => {
        const mine = localById.get(match.id);
        if (!mine?.lastMessage) {
          return match;
        }

        const serverTime = timeOf(match.lastMessage?.insertedAt);
        const localTime = timeOf(mine.lastMessage.insertedAt);

        if (localTime > serverTime) {
          return {
            ...match,
            lastMessage: mine.lastMessage,
            expiresAt: null,
            firstMessageAt: match.firstMessageAt ?? mine.firstMessageAt,
            unreadCount: mine.unreadCount
          };
        }

        return match;
      })
  );
}

const initialState = {
  matches: [] as MatchSummary[],
  status: "idle" as MatchesStatus,
  error: null as unknown,
  refreshing: false,
  lastLoadedAt: null as number | null,
  nextCursor: null as string | null,
  loadingMore: false
};

export const useMatchesStore = create<MatchesState>((set, get) => ({
  ...initialState,

  load(fetchMatches, mode = "initial") {
    const { status } = get();

    if (mode === "refresh") {
      set({ refreshing: true });
    } else if (mode === "initial" && (status === "idle" || status === "error")) {
      set({ status: "loading", error: null });
    }

    if (inFlight) {
      return inFlight;
    }

    const loadGeneration = ++generation;
    const initialActivity = new Map(get().matches.map((match) => [match.id, lastActivityAt(match)]));
    pageInFlight = null;
    set({ loadingMore: false });

    const request = fetchMatches()
      .then(
        (page) => {
          if (loadGeneration !== generation) {
            return;
          }

          const serverIds = new Set(page.matches.map((match) => match.id));
          const arrived = get().matches.filter((match) =>
            !serverIds.has(match.id) && !removedIds.has(match.id) &&
            (!initialActivity.has(match.id) || lastActivityAt(match) > initialActivity.get(match.id)!)
          );
          set({
            matches: sortMatchesByActivity([...mergeServerMatches(page.matches, get().matches), ...arrived]),
            nextCursor: page.nextCursor,
            status: "ready",
            error: null,
            lastLoadedAt: Date.now()
          });
        },
        (error: unknown) => {
          if (loadGeneration !== generation) {
            return;
          }

          set(get().status === "ready" ? { error } : { status: "error", error });
        }
      )
      .finally(() => {
        if (loadGeneration === generation) {
          set({ refreshing: false });
        }
        if (inFlight === request) inFlight = null;
      });

    inFlight = request;
    return request;
  },

  loadMore(fetchPage) {
    const cursor = get().nextCursor;
    if (!cursor || inFlight || get().status !== "ready") return Promise.resolve();
    if (pageInFlight) return pageInFlight;
    const pageGeneration = generation;
    set({ loadingMore: true, error: null });

    const request = fetchPage(cursor)
      .then((page) => {
        if (generation !== pageGeneration) return;
        const existing = new Set(get().matches.map((match) => match.id));
        const additions = page.matches.filter((match) => !existing.has(match.id) && !removedIds.has(match.id));
        set({ matches: sortMatchesByActivity([...get().matches, ...additions]), nextCursor: page.nextCursor });
      }, (error: unknown) => {
        if (generation === pageGeneration) set({ error });
      })
      .finally(() => {
        if (generation === pageGeneration) set({ loadingMore: false });
        if (pageInFlight === request) pageInFlight = null;
      });
    pageInFlight = request;
    return request;
  },

  upsertFetchedMatch(match) {
    if (removedIds.has(match.id)) return;
    const current = get().matches;
    const merged = mergeServerMatches([match], current);
    set({ matches: sortMatchesByActivity([...merged, ...current.filter((entry) => entry.id !== match.id)]) });
  },

  addFromDiscoveryMatch(match) {
    const { matches } = get();

    if (matches.some((existing) => existing.id === match.id)) {
      return;
    }

    removedIds.delete(match.id);
    set({ matches: sortMatchesByActivity([matchSummaryFromDiscoveryMatch(match), ...matches]) });
  },

  applyMessage(conversationId, message, { read }) {
    const { matches } = get();
    let changed = false;

    const next = matches.map((match) => {
      if (match.conversationId !== conversationId) {
        return match;
      }

      const updated = applyMessageToMatch(match, message, { read });
      changed ||= updated !== match;
      return updated;
    });

    if (changed) {
      set({ matches: sortMatchesByActivity(next) });
    }
  },

  markRead(conversationId) {
    const { matches } = get();

    if (!matches.some((match) => match.conversationId === conversationId && match.unreadCount > 0)) {
      return;
    }

    set({
      matches: matches.map((match) => (match.conversationId === conversationId ? { ...match, unreadCount: 0 } : match))
    });
  },

  removeMatch(matchId) {
    removedIds.add(matchId);
    const { matches } = get();

    if (matches.some((match) => match.id === matchId)) {
      set({ matches: matches.filter((match) => match.id !== matchId) });
    }
  },

  reset() {
    generation += 1;
    sessionEpoch += 1;
    inFlight = null;
    pageInFlight = null;
    removedIds.clear();
    set({ ...initialState });
  }
}));

export function selectMatchByConversationId(conversationId: string) {
  return (state: MatchesState): MatchSummary | null =>
    state.matches.find((match) => match.conversationId === conversationId) ?? null;
}

onSignOut(() => useMatchesStore.getState().reset());
