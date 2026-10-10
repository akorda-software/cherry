import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DiscoveryActionRequest,
  DiscoveryActionResponse,
  DiscoveryFeedPage,
  DiscoveryMatch,
  DiscoveryProfileCard
} from "@cherry/contracts";

export interface DiscoveryFeedDeps {
  fetchPage: (cursor: string | null) => Promise<DiscoveryFeedPage>;
  recordAction: (request: DiscoveryActionRequest) => Promise<DiscoveryActionResponse>;
}

export type DiscoveryFeedStatus = "loading" | "ready" | "error";

export interface UseDiscoveryFeedResult {
  profiles: DiscoveryProfileCard[];
  status: DiscoveryFeedStatus;
  error: string | null;
  actionError: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  lastMatch: DiscoveryMatch | null;
  actingOnProfileId: string | null;
  reload(): Promise<void>;
  loadMore(): Promise<void>;
  act(request: DiscoveryActionRequest): Promise<DiscoveryActionResponse | null>;
  dismissMatch(): void;
}

export function useDiscoveryFeed({ fetchPage, recordAction }: DiscoveryFeedDeps): UseDiscoveryFeedResult {
  const [profiles, setProfiles] = useState<DiscoveryProfileCard[]>([]);
  const [status, setStatus] = useState<DiscoveryFeedStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastMatch, setLastMatch] = useState<DiscoveryMatch | null>(null);
  const [actingOnProfileId, setActingOnProfileId] = useState<string | null>(null);

  const cursorRef = useRef<string | null>(null);
  const reloadingRef = useRef(false);

  const reload = useCallback(async () => {
    if (reloadingRef.current) {
      return;
    }

    reloadingRef.current = true;
    setStatus("loading");
    setError(null);

    try {
      const page = await fetchPage(null);
      cursorRef.current = page.nextCursor;
      setProfiles(page.profiles);
      setHasMore(page.nextCursor !== null);
      setStatus("ready");
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus("error");
    } finally {
      reloadingRef.current = false;
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || reloadingRef.current) {
      return;
    }

    setLoadingMore(true);

    try {
      const page = await fetchPage(cursorRef.current);
      cursorRef.current = page.nextCursor;
      setProfiles((prev) => appendUnique(prev, page.profiles));
      setHasMore(page.nextCursor !== null);
    } catch {
      // Transient: the user can retry by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore]);

  const act = useCallback(
    async (request: DiscoveryActionRequest): Promise<DiscoveryActionResponse | null> => {
      const snapshot = profiles;
      setActionError(null);
      setActingOnProfileId(request.targetProfileId);
      setProfiles((prev) => prev.filter((profile) => profile.id !== request.targetProfileId));

      try {
        const response = await recordAction(request);

        if (response.matchCreated) {
          setLastMatch(response.match);
        }

        return response;
      } catch (err) {
        setProfiles((prev) => restoreRemoved(prev, snapshot, request.targetProfileId));
        setActionError(toErrorMessage(err));
        return null;
      } finally {
        setActingOnProfileId(null);
      }
    },
    [profiles, recordAction]
  );

  const dismissMatch = useCallback(() => setLastMatch(null), []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    profiles,
    status,
    error,
    actionError,
    hasMore,
    loadingMore,
    lastMatch,
    actingOnProfileId,
    reload,
    loadMore,
    act,
    dismissMatch
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Algo salió mal. Inténtalo de nuevo.";
}

function appendUnique(
  prev: DiscoveryProfileCard[],
  next: DiscoveryProfileCard[]
): DiscoveryProfileCard[] {
  const seen = new Set(prev.map((profile) => profile.id));
  const additions = next.filter((profile) => !seen.has(profile.id));

  return additions.length === 0 ? prev : [...prev, ...additions];
}

function restoreRemoved(
  current: DiscoveryProfileCard[],
  snapshot: DiscoveryProfileCard[],
  targetId: string
): DiscoveryProfileCard[] {
  if (current.some((profile) => profile.id === targetId)) {
    return current;
  }

  const original = snapshot.find((profile) => profile.id === targetId);

  if (original === undefined) {
    return current;
  }

  const originalIndex = snapshot.findIndex((profile) => profile.id === targetId);
  const filtered = current.filter((profile) => profile.id !== targetId);
  const before = filtered.slice(0, originalIndex);
  const after = filtered.slice(originalIndex);

  return [...before, original, ...after];
}
