import type {
  DiscoveryProfileCard,
  PhotoSummary,
  ProfileTag,
  PublicProfile
} from "@snack/contracts";

/**
 * Lo mínimo para pintar a una persona, venga de donde venga: card del feed o de
 * likes (`DiscoveryProfileCard`) o perfil público (`PublicProfile`).
 */
export interface ProfilePerson {
  id: string;
  displayName: string;
  age: number | null;
  bio: string | null;
  gender: string | null;
  whatIAmLookingFor: string | null;
  distanceLabel: string | null;
  photos: PhotoSummary[];
  /** Compartidas primero (ver `sortTagsForDisplay`). */
  tags: ProfileTag[];
  sharedTagsCount: number;
  likedYou: boolean;
  isNewcomer: boolean;
  beyondPreferredDistance: boolean;
}

export type PersonSource = DiscoveryProfileCard | PublicProfile | ProfilePerson;

function isPerson(source: PersonSource): source is ProfilePerson {
  // `photoCount` solo existe en las cards (`score` ya no lo envía el backend).
  return "sharedTagsCount" in source && !("photoCount" in source) && Array.isArray(source.tags);
}

/** Normaliza una card o un perfil público al modelo que pintan los átomos de `profile-card`. */
export function toProfilePerson(source: PersonSource): ProfilePerson {
  if (isPerson(source)) {
    return source;
  }

  const tags = sortTagsForDisplay((source.tags ?? []) as ProfileTag[]);
  const photos = normalizePhotos(source);
  const card = source as Partial<DiscoveryProfileCard>;

  return {
    id: source.id,
    displayName: source.displayName,
    age: typeof source.age === "number" ? source.age : null,
    bio: source.bio ?? null,
    gender: source.gender ?? null,
    whatIAmLookingFor: source.whatIAmLookingFor ?? null,
    distanceLabel: source.distanceLabel ?? null,
    photos,
    tags,
    sharedTagsCount:
      typeof card.sharedTagsCount === "number"
        ? card.sharedTagsCount
        : tags.filter((tag) => tag.shared).length,
    likedYou: source.likedYou === true,
    isNewcomer: source.isNewcomer === true,
    beyondPreferredDistance: card.beyondPreferredDistance === true
  };
}

function normalizePhotos(source: DiscoveryProfileCard | PublicProfile): PhotoSummary[] {
  const photos = [...(source.photos ?? [])].sort((a, b) => a.position - b.position);

  if (photos.length > 0) {
    return photos;
  }

  const primary = (source as Partial<DiscoveryProfileCard>).photoUrl;

  return typeof primary === "string" && primary !== ""
    ? [{ id: `${source.id}-primary`, url: primary, position: 1 }]
    : [];
}

/** Compartidas primero; luego categoría del catálogo, `sortOrder` y etiqueta. */
export function sortTagsForDisplay(tags: ProfileTag[]): ProfileTag[] {
  return [...tags].sort((a, b) => {
    if (a.shared !== b.shared) {
      return a.shared ? -1 : 1;
    }

    const byCategory = categoryRank(a.category) - categoryRank(b.category);

    if (byCategory !== 0) {
      return byCategory;
    }

    const bySort = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

    return bySort !== 0 ? bySort : a.label.localeCompare(b.label, "es");
  });
}

export const TAG_CATEGORY_ORDER = [
  "interests",
  "active",
  "lifestyle",
  "values",
  "personality",
  "pets",
  "relationship"
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  interests: "Intereses",
  active: "Vida activa",
  lifestyle: "Estilo de vida",
  values: "Valores",
  personality: "Personalidad",
  pets: "Mascotas",
  relationship: "Relación y familia"
};

export function tagCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? "Más cosas";
}

function categoryRank(category: string): number {
  const index = (TAG_CATEGORY_ORDER as readonly string[]).indexOf(category);

  return index === -1 ? TAG_CATEGORY_ORDER.length : index;
}

export interface TagGroup {
  category: string;
  label: string;
  tags: ProfileTag[];
}

/** Etiquetas NO compartidas agrupadas por categoría (en el orden del catálogo). */
export function groupOtherTagsByCategory(tags: ProfileTag[]): TagGroup[] {
  const groups = new Map<string, ProfileTag[]>();

  for (const tag of sortTagsForDisplay(tags)) {
    if (tag.shared) {
      continue;
    }

    const list = groups.get(tag.category) ?? [];
    list.push(tag);
    groups.set(tag.category, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
    .map(([category, list]) => ({ category, label: tagCategoryLabel(category), tags: list }));
}

export function sharedTags(tags: ProfileTag[]): ProfileTag[] {
  return sortTagsForDisplay(tags).filter((tag) => tag.shared);
}

/** «Lucía, 29» o solo «Lucía» si no hay edad. */
export function nameWithAge(person: Pick<ProfilePerson, "displayName" | "age">): string {
  return person.age === null ? person.displayName : `${person.displayName}, ${person.age}`;
}
