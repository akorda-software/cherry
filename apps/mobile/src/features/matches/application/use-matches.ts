import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { MatchSummary } from "@cherry/contracts";
import { createMatchesApi } from "@cherry/mobile-shared";

import { refreshActivitySummary } from "../../activity/application/activity-poller";
import { useAuthedApi } from "../../auth/presentation";
import { splitMatches, type MatchSections } from "../domain/match-list";
import { getMatchesSessionEpoch, selectMatchByConversationId, useMatchesStore, type MatchesLoadMode } from "./matches-store";

/** Carga de `GET /api/matches` con auth (estable mientras no cambie la sesión). */
export function useMatchesLoader(): (mode?: MatchesLoadMode) => Promise<void> {
  const callApi = useAuthedApi(createMatchesApi);

  return useCallback(
    (mode: MatchesLoadMode = "initial") => useMatchesStore.getState().load(() => callApi((api) => api.list()), mode),
    [callApi]
  );
}

export interface MatchesListResult extends MatchSections {
  matches: MatchSummary[];
  status: ReturnType<typeof useMatchesStore.getState>["status"];
  error: unknown;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore(): Promise<void>;
  reload(): Promise<void>;
  refresh(): Promise<void>;
  refreshSilently(): Promise<void>;
}

/** Pestaña Chats: matches separados en «Nuevos matches» y conversaciones. Carga al montar. */
export function useMatchesList(): MatchesListResult {
  const load = useMatchesLoader();
  const callApi = useAuthedApi(createMatchesApi);
  const { matches, status, error, refreshing, loadingMore, nextCursor } = useMatchesStore(
    useShallow((state) => ({
      matches: state.matches,
      status: state.status,
      error: state.error,
      refreshing: state.refreshing,
      loadingMore: state.loadingMore,
      nextCursor: state.nextCursor
    }))
  );

  const sections = useMemo(() => splitMatches(matches), [matches]);

  useEffect(() => {
    void load("initial");
  }, [load]);

  return {
    ...sections,
    matches,
    status,
    error,
    refreshing,
    loadingMore,
    hasMore: nextCursor !== null,
    loadMore: useCallback(() => useMatchesStore.getState().loadMore((cursor) => callApi((api) => api.list({ cursor }))), [callApi]),
    reload: useCallback(() => load("initial"), [load]),
    refresh: useCallback(async () => {
      await Promise.all([load("refresh"), refreshActivitySummary({ force: true })]);
    }, [load]),
    refreshSilently: useCallback(() => load("silent"), [load])
  };
}

/**
 * Match de una conversación (cabecera del chat). Si la lista aún no está cargada (llegada desde
 * una notificación o un enlace), la pide.
 */
export function useMatchForConversation(conversationId: string): {
  match: MatchSummary | null;
  status: ReturnType<typeof useMatchesStore.getState>["status"];
  reload(): Promise<void>;
} {
  const callApi = useAuthedApi(createMatchesApi);
  const selector = useMemo(() => selectMatchByConversationId(conversationId), [conversationId]);
  const match = useMatchesStore(selector);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const requestGeneration = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestGeneration.current;
    const session = getMatchesSessionEpoch();
    const current = () => request === requestGeneration.current && session === getMatchesSessionEpoch();
    setStatus("loading");
    try {
      const entry = await callApi((api) => api.getForConversation(conversationId));
      if (!current()) return;
      useMatchesStore.getState().upsertFetchedMatch(entry);
      setStatus("ready");
    } catch {
      if (current()) setStatus("error");
    }
  }, [callApi, conversationId]);

  useEffect(() => {
    if (selectMatchByConversationId(conversationId)(useMatchesStore.getState()) === null) {
      void reload();
    }
    return () => { requestGeneration.current += 1; };
  }, [conversationId, reload]);

  return { match, status: match ? "ready" : status, reload };
}

/** Deshacer match: llama al backend y lo quita de la lista. */
export function useUnmatch(): (matchId: string) => Promise<void> {
  const callApi = useAuthedApi(createMatchesApi);

  return useCallback(
    async (matchId: string) => {
      await callApi((api) => api.unmatch(matchId));
      useMatchesStore.getState().removeMatch(matchId);
      void refreshActivitySummary({ force: true });
    },
    [callApi]
  );
}
