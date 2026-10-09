import { describeIntents, type PersonSource, profileBadges, sharedTags, toProfilePerson } from "../../profile-card";

/** Descripción para lectores de pantalla de una card (swipe o feed). */
export function describePerson(source: PersonSource): string {
  const person = toProfilePerson(source);
  const parts: string[] = [person.age === null ? person.displayName : `${person.displayName}, ${person.age} años`];
  for (const intent of describeIntents(person.lookingFor)) {
    parts.push(intent.sentence);
  }

  if (person.distanceLabel) {
    parts.push(person.distanceLabel);
  }

  const shared = sharedTags(person.tags);

  if (shared.length > 0) {
    parts.push(`En común: ${shared.map((tag) => tag.label).join(", ")}`);
  }

  for (const badge of profileBadges(person, { includeShared: false })) {
    parts.push(badge.label);
  }

  if (person.photos.length > 1) {
    parts.push(`${person.photos.length} fotos`);
  }

  return parts.join(". ");
}
