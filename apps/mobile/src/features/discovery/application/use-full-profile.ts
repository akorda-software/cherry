import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";

import type {
  DiscoveryActionResponse,
  DiscoveryActionType,
  DiscoveryMatch,
  DiscoveryProfileCard,
  PublicProfile
} from "@cherry/contracts";

import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { type ProfilePerson, toProfilePerson } from "../../profile-card/domain/person";
import { classifyActionError } from "../domain/feed-errors";
import type { DiscoveryQueueStore } from "./discovery-queue";
import { type ProfileOrigin, useProfileTransitStore } from "./profile-transit";

export interface FullProfileDeps {
  getProfile(profileId: string): Promise<PublicProfile>;
  recordAction(request: { targetProfileId: string; actionType: DiscoveryActionType }): Promise<DiscoveryActionResponse>;
  queue: StoreApi<DiscoveryQueueStore>;
  showMatch(match: DiscoveryMatch): void;
}

export type FullProfileStatus = "loading" | "ready" | "not_found" | "error";

export interface FullProfileRelationship {
  likedYou: boolean;
  youLiked: boolean;
  matchId: string | null;
  conversationId: string | null;
}

export interface FullProfileController {
  status: FullProfileStatus;
  person: ProfilePerson | null;
  origin: ProfileOrigin;
  relationship: FullProfileRelationship;
  /** Se está refrescando con `GET /api/profiles/:id` (ya pintamos lo que había). */
  refreshing: boolean;
  error: string | null;
  acting: DiscoveryActionType | null;
  actionError: string | null;
  reload(): void;
  /** `true` si la acción está hecha (o en marcha en la cola de Descubrir) y se puede volver atrás. */
  act(action: DiscoveryActionType): Promise<boolean>;
  /** Tras bloquear/reportar: saca a la persona de Descubrir y avisa al origen. */
  afterSafetyAction(kind: "blocked" | "reported"): void;
}

export function useFullProfile(profileId: string, deps: FullProfileDeps): FullProfileController {
  const staged = useProfileTransitStore((state) => state.entries[profileId]);
  const [remote, setRemote] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<FullProfileStatus>(staged ? "ready" : "loading");
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<DiscoveryActionType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const hasStaged = staged !== undefined;

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    setError(null);

    depsRef.current
      .getProfile(profileId)
      .then((profile) => {
        if (!cancelled) {
          setRemote(profile);
          setStatus("ready");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        if (apiErrorCode(err) === "profile_not_found") {
          setStatus("not_found");
          return;
        }

        const message = friendlyErrorMessage(err, "No hemos podido cargar este perfil. Inténtalo otra vez.");
        setError(message);
        setStatus(hasStaged ? "ready" : "error");
      })
      .finally(() => {
        if (!cancelled) {
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, hasStaged, profileId]);

  const stagedCard = staged?.profile;
  const person = useMemo(() => {
    if (remote) {
      const merged = toProfilePerson(remote);
      const card = stagedCard as Partial<DiscoveryProfileCard> | undefined;

      return card?.beyondPreferredDistance ? { ...merged, beyondPreferredDistance: true } : merged;
    }

    return stagedCard ? toProfilePerson(stagedCard) : null;
  }, [remote, stagedCard]);

  const relationship: FullProfileRelationship = {
    likedYou: remote?.likedYou ?? stagedCard?.likedYou ?? false,
    youLiked: remote?.youLiked ?? false,
    matchId: remote?.matchId ?? null,
    conversationId: remote?.conversationId ?? null
  };

  const origin: ProfileOrigin = staged?.origin ?? "other";

  const act = useCallback(
    async (action: DiscoveryActionType): Promise<boolean> => {
      const { queue, recordAction, showMatch } = depsRef.current;
      setActionError(null);

      const queued = queue.getState().profiles.find((card) => card.id === profileId);
      const discoverCard = queued ?? (origin === "discover" ? (stagedCard as DiscoveryProfileCard | undefined) : undefined);

      // Desde Descubrir: la cola ya sabe ser optimista, avisar del match y deshacer si falla.
      if (discoverCard) {
        void queue.getState().act(discoverCard, action);
        staged?.onAction?.({ action, response: null });
        return true;
      }

      setActing(action);

      try {
        const response = await recordAction({ targetProfileId: profileId, actionType: action });

        if (response.matchCreated) {
          showMatch(response.match);
        }

        staged?.onAction?.({ action, response });
        return true;
      } catch (err) {
        if (classifyActionError(err) === "settled") {
          staged?.onAction?.({ action, response: null });
          return true;
        }

        setActionError(
          friendlyErrorMessage(err, action === "like" ? "No hemos podido enviar tu like." : "No hemos podido guardarlo.")
        );
        return false;
      } finally {
        setActing(null);
      }
    },
    [origin, profileId, staged, stagedCard]
  );

  const afterSafetyAction = useCallback(
    (kind: "blocked" | "reported") => {
      if (kind === "blocked") {
        depsRef.current.queue.getState().remove(profileId);
      }

      staged?.onSafetyAction?.(kind);
    },
    [profileId, staged]
  );

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    status,
    person,
    origin,
    relationship,
    refreshing,
    error,
    acting,
    actionError,
    reload,
    act,
    afterSafetyAction
  };
}
