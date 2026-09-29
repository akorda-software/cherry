import { useRouter } from "expo-router";
import { useCallback } from "react";

import type { DiscoveryProfileCard, PublicProfile } from "@snack/contracts";

import { profileHref } from "../../../shared/ui";
import { stageProfile, type StageProfileOptions } from "../application/profile-transit";

/**
 * Abre el perfil completo de otra persona (`/(app)/profile/[id]`) pintándolo al instante
 * con la card que ya tienes:
 *
 *   const openProfile = useOpenProfile();
 *   openProfile(card, { origin: "likes", onAction: ({ action }) => removeFromList(card.id) });
 */
export function useOpenProfile() {
  const router = useRouter();

  return useCallback(
    (profile: DiscoveryProfileCard | PublicProfile, options?: StageProfileOptions) => {
      stageProfile(profile, options);
      router.push(profileHref(profile.id));
    },
    [router]
  );
}
