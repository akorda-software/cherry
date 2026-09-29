import { useEffect, useMemo, useState } from "react";

import type { ProfileTag } from "@snack/contracts";
import { createPublicProfileApi } from "@snack/mobile-shared";

import { useAuthedApi } from "../../auth/presentation";
import { buildIcebreakers, type Icebreaker } from "../domain/icebreakers";

/**
 * Rompehielos de una conversación vacía: pide el perfil público de la otra persona
 * (`GET /api/profiles/:id`, etiquetas con `shared`) solo cuando hacen falta.
 */
export function useIcebreakers(
  profileId: string | null,
  enabled: boolean,
  seed: string
): { icebreakers: Icebreaker[]; loading: boolean } {
  const callApi = useAuthedApi(createPublicProfileApi);
  const [tagsByProfile, setTagsByProfile] = useState<{ profileId: string; tags: ProfileTag[] } | null>(null);
  const tags = tagsByProfile && tagsByProfile.profileId === profileId ? tagsByProfile.tags : null;

  useEffect(() => {
    if (!enabled || !profileId || tags !== null) {
      return undefined;
    }

    let cancelled = false;
    callApi((api) => api.getProfile(profileId)).then(
      (profile) => {
        if (!cancelled) {
          setTagsByProfile({ profileId, tags: profile.tags ?? [] });
        }
      },
      () => {
        // Sin perfil (red, 404): sugerencias genéricas, nunca un error por esto.
        if (!cancelled) {
          setTagsByProfile({ profileId, tags: [] });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [callApi, enabled, profileId, tags]);

  const icebreakers = useMemo(() => buildIcebreakers(tags, { seed }), [seed, tags]);

  return { icebreakers, loading: enabled && profileId !== null && tags === null };
}
