import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { MatchSummary } from "@snack/contracts";
import { createMatchesApi } from "@snack/mobile-shared";

import { refreshActivitySummary } from "../../activity/application/activity-poller";
import { useAuthedApi } from "../../auth/presentation";
import { splitMatches, type MatchSections } from "../domain/match-list";
import { selectMatchByConversationId, useMatchesStore, type MatchesLoadMode } from "./matches-store";

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
  reload(): Promise<void>;
  refresh(): Promise<void>;
  refreshSilently(): Promise<void>;
}

/** Pestaña Chats: matches separados en «Nuevos matches» y conversaciones. Carga al montar. */
export function useMatchesList(): MatchesListResult {
  const load = useMatchesLoader();
  const { matches, status, error, refreshing } = useMatchesStore(
    useShallow((state) => ({
      matches: state.matches,
      status: state.status,
      error: state.error,
      refreshing: state.refreshing
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
  const load = useMatchesLoader();
  const selector = useMemo(() => selectMatchByConversationId(conversationId), [conversationId]);
  const match = useMatchesStore(selector);
  const status = useMatchesStore((state) => state.status);

  useEffect(() => {
    if (match === null && status !== "loading") {
      void load(status === "ready" ? "silent" : "initial");
    }
    // Solo al entrar en la conversación: no queremos bucles si de verdad no existe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, load]);

  return { match, status, reload: useCallback(() => load("initial"), [load]) };
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
