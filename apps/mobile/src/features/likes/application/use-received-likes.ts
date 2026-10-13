import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import type { DiscoveryMatch } from "@cherry/contracts";
import { RECEIVED_LIKES_DEFAULT_LIMIT } from "@cherry/contracts";
import { createDiscoveryApi, createLikesApi } from "@cherry/mobile-shared";

import { useActivityStore } from "../../activity/application/activity-store";
import { useAuthedApi } from "../../auth/presentation";
import { useMatchCelebrationStore } from "../../match/match-celebration-store";
import { useMatchesStore } from "../../matches/application/matches-store";
import { useReceivedLikesStore, type ReceivedLikesDeps, type RespondResult } from "./received-likes-store";

/** Efectos de un match creado desde Likes: celebración, lista de chats y badge. */
export function celebrateMatch(match: DiscoveryMatch) {
  useMatchesStore.getState().addFromDiscoveryMatch(match);
  useActivityStore.getState().adjust({ newMatchesCount: 1 });
  useMatchCelebrationStore.getState().show(match);
}

/** Dependencias autenticadas del store de likes (estables mientras no cambie la sesión). */
export function useReceivedLikesDeps(): ReceivedLikesDeps {
  const likesApi = useAuthedApi(createLikesApi);
  const discoveryApi = useAuthedApi(createDiscoveryApi);

  return useMemo<ReceivedLikesDeps>(
    () => ({
      fetchPage: (cursor) => likesApi((api) => api.listReceived({ cursor, limit: RECEIVED_LIKES_DEFAULT_LIMIT })),
      recordAction: (request) => discoveryApi((api) => api.recordAction(request)),
      undo: () => discoveryApi((api) => api.undo()),
      onMatch: celebrateMatch,
      onCountDelta: (delta) => useActivityStore.getState().adjust({ receivedLikesCount: delta })
    }),
    [discoveryApi, likesApi]
  );
}

export interface ReceivedLikesController {
  reload(): Promise<void>;
  refresh(): Promise<void>;
  refreshSilently(): Promise<void>;
  loadMore(): Promise<void>;
  like(profileId: string): Promise<RespondResult>;
  pass(profileId: string): Promise<RespondResult>;
  undoPass(): Promise<boolean>;
  dismissUndo(): void;
  dismissNotice(): void;
}

/**
 * Estado + acciones de la pestaña Likes. Carga al montar; `refreshSilently` para el foco.
 */
export function useReceivedLikes() {
  const deps = useReceivedLikesDeps();

  const state = useReceivedLikesStore(
    useShallow((s) => ({
      likes: s.likes,
      status: s.status,
      error: s.error,
      refreshing: s.refreshing,
      loadingMore: s.loadingMore,
      hasMore: s.hasMore,
      pending: s.pending,
      lastPass: s.lastPass,
      undoing: s.undoing,
      notice: s.notice
    }))
  );

  const actions = useMemo<ReceivedLikesController>(() => {
    const store = () => useReceivedLikesStore.getState();
    return {
      reload: () => store().load(deps, "initial"),
      refresh: () => store().load(deps, "refresh"),
      refreshSilently: () => store().load(deps, "silent"),
      loadMore: () => store().loadMore(deps),
      like: (profileId) => store().respond(deps, profileId, "like"),
      pass: (profileId) => store().respond(deps, profileId, "dislike"),
      undoPass: () => store().undoPass(deps),
      dismissUndo: () => store().dismissUndo(),
      dismissNotice: () => store().dismissNotice()
    };
  }, [deps]);

  useEffect(() => {
    void actions.reload();
  }, [actions]);

  return { ...state, ...actions };
}
