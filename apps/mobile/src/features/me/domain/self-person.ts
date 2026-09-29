import type { Profile } from "@snack/contracts";

import type { ProfilePerson } from "../../profile-card/domain/person";

/**
 * Tu perfil tal como lo pintan las tarjetas de los demás («Así te ven»): sin distancia,
 * sin insignias de relación (nadie comparte etiquetas contigo mismo) y solo fotos activas.
 */
export function toSelfPerson(profile: Profile): ProfilePerson {
  const photos = profile.photos
    .filter((photo) => photo.isActive)
    .sort((a, b) => a.position - b.position)
    .map(({ id, url, position }) => ({ id, url, position }));

  return {
    id: profile.id,
    displayName: profile.displayName?.trim() || "Tú",
    age: profile.age,
    bio: profile.bio,
    gender: profile.gender,
    whatIAmLookingFor: profile.whatIAmLookingFor,
    distanceLabel: null,
    photos,
    tags: profile.tags.map((tag) => ({ ...tag, shared: false })),
    sharedTagsCount: 0,
    likedYou: false,
    isNewcomer: false,
    beyondPreferredDistance: false
  };
}
