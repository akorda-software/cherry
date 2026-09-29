import { create } from "zustand";

import type { ChatMessage, DiscoveryMatch, MatchSummary } from "@snack/contracts";

import { onSignOut } from "../../auth/presentation/on-sign-out";
import { applyMessageToMatch, lastActivityAt, matchSummaryFromDiscoveryMatch } from "../domain/match-list";

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

  load(fetchMatches: () => Promise<MatchSummary[]>, mode?: MatchesLoadMode): Promise<void>;
  /** Match recién creado (like mutuo): aparece en «Nuevos matches» al instante. */
  addFromDiscoveryMatch(match: DiscoveryMatch): void;
  applyMessage(conversationId: string, message: ChatMessage, options: { read: boolean }): void;
  markRead(conversationId: string): void;
  /** Tras deshacer el match o bloquear. */
  removeMatch(matchId: string): void;
  reset(): void;
}

let inFlight: Promise<void> | null = null;
let generation = 0;
/** Matches quitados en local mientras una carga estaba en vuelo (no deben reaparecer). */
const removedIds = new Set<string>();

function sortByActivity(matches: MatchSummary[]): MatchSummary[] {
  return [...matches].sort((a, b) => lastActivityAt(b) - lastActivityAt(a));
}

function timeOf(iso: string | undefined): number {
  const time = iso ? Date.parse(iso) : 0;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * La respuesta del servidor manda sobre qué matches existen; si en local hay un mensaje más
 * reciente (enviado o recibido mientras la petición volaba), se conserva.
 */
export function mergeServerMatches(server: MatchSummary[], local: MatchSummary[]): MatchSummary[] {
  const localById = new Map(local.map((match) => [match.id, match]));

  return sortByActivity(
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
  lastLoadedAt: null as number | null
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

    const loadGeneration = generation;

    inFlight = fetchMatches()
      .then(
        (matches) => {
          if (loadGeneration !== generation) {
            return;
          }

          set({
            matches: mergeServerMatches(matches, get().matches),
            status: "ready",
            error: null,
            lastLoadedAt: Date.now()
          });
          removedIds.clear();
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
        inFlight = null;
      });

    return inFlight;
  },

  addFromDiscoveryMatch(match) {
    const { matches } = get();

    if (matches.some((existing) => existing.id === match.id)) {
      return;
    }

    removedIds.delete(match.id);
    set({ matches: sortByActivity([matchSummaryFromDiscoveryMatch(match), ...matches]) });
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
      set({ matches: sortByActivity(next) });
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
    inFlight = null;
    removedIds.clear();
    set({ ...initialState });
  }
}));

export function selectMatchByConversationId(conversationId: string) {
  return (state: MatchesState): MatchSummary | null =>
    state.matches.find((match) => match.conversationId === conversationId) ?? null;
}

onSignOut(() => useMatchesStore.getState().reset());
