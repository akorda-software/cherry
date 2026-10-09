import type { DiscoveryPreferences, Profile, ProfilePhoto, Tag } from "@snack/contracts";

/** Datos de prueba del perfil propio (solo tests). */
export function makeTag(index: number, overrides: Partial<Tag> = {}): Tag {
  return {
    id: `tag-${index}`,
    slug: `tag_${index}`,
    label: `Etiqueta ${index}`,
    category: "interests",
    sortOrder: index,
    emoji: "✨",
    ...overrides
  };
}

export function makePhoto(position: number, overrides: Partial<ProfilePhoto> = {}): ProfilePhoto {
  return {
    id: `photo-${position}`,
    storageKey: `profiles/p/${position}.jpg`,
    url: `http://localhost:4000/uploads/profiles/p/${position}.jpg`,
    position,
    isActive: true,
    ...overrides
  };
}

export function makePreferences(overrides: Partial<DiscoveryPreferences> = {}): DiscoveryPreferences {
  return {
    ageMin: 23,
    ageMax: 37,
    distanceKm: 50,
    showMen: false,
    showWomen: true,
    showNonBinary: false,
    compatibleOnly: false,
    expandDistance: true,
    discoveryMode: "swipe",
    ...overrides
  };
}

/** Perfil COMPLETO según las reglas del flujo; sobrescribe lo que quieras romper. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "profile-1",
    displayName: "Lucía",
    birthDate: "1996-05-14",
    age: 30,
    gender: "woman",
    lookingFor: ["relationship"],
    whatIAmLookingFor: "relationship",
    bio: "Me encantan los domingos de mercadillo y café.",
    isComplete: false,
    isPaused: false,
    isDiscoverable: false,
    hasLocation: true,
    photos: [makePhoto(1), makePhoto(2)],
    tags: [makeTag(1), makeTag(2), makeTag(3)],
    blockedTags: [],
    discoveryPreferences: makePreferences(),
    insertedAt: "2026-09-29T10:00:00Z",
    updatedAt: "2026-09-29T10:00:00Z",
    ...overrides
  };
}

/** Error como los que lanza `createJsonHttpClient` (status, code = body.error, body). */
export function apiError(status: number, body: unknown): Error & { status: number; code?: string; body: unknown } {
  const code = (body as { error?: unknown } | null)?.error;
  const error = new Error(typeof code === "string" ? code : `Request failed with status ${status}`) as Error & {
    status: number;
    code?: string;
    body: unknown;
  };
  error.status = status;
  error.code = typeof code === "string" ? code : undefined;
  error.body = body;
  return error;
}
