import {
  MAX_POSITIVE_TAGS,
  MAX_PROFILE_PHOTOS,
  MIN_PROFILE_PHOTOS,
  type Profile
} from "@cherry/contracts";

import { meRoutes, type MeRoute } from "./me-routes";

/** Mismos límites que el backend (`Cherry.Dating.profile_completion_missing/1`). */
export const BIO_MIN_LENGTH = 20;
/** A partir de aquí dejamos de sugerir etiquetas: con 3 ya hay de dónde tirar para encontrar afinidad. */
export const COMFORTABLE_TAG_COUNT = 3;

export type ProfileSuggestionId =
  | "photos-missing"
  | "tags-missing"
  | "bio-missing"
  | "basics-missing"
  | "preferences-missing"
  | "photos-room"
  | "tags-few";

export interface ProfileSuggestion {
  id: ProfileSuggestionId;
  /** Frase corta, concreta y amable. Nunca culpabiliza. */
  text: string;
  /** Texto del botón que lo resuelve. */
  actionLabel: string;
  href: MeRoute;
  /** Sin esto el perfil no está completo (y no aparece en Descubrir). */
  essential: boolean;
}

export type ProfileStrengthTone = "shining" | "polish" | "incomplete";

export interface ProfileStrength {
  tone: ProfileStrengthTone;
  title: string;
  message: string;
  suggestions: ProfileSuggestion[];
}

type ProfileSnapshot = Pick<
  Profile,
  | "photos"
  | "tags"
  | "bio"
  | "isComplete"
  | "displayName"
  | "birthDate"
  | "gender"
  | "lookingFor"
>;

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/**
 * Cómo de «listo» está tu perfil y qué podrías añadir. Lo esencial (lo que el backend exige
 * para aparecer en Descubrir) va primero; lo opcional solo se sugiere cuando lo esencial está.
 */
export function assessProfileStrength(profile: ProfileSnapshot): ProfileStrength {
  const photoCount = profile.photos.length;
  const tagCount = profile.tags.length;
  const bioLength = profile.bio?.trim().length ?? 0;

  const essentials: ProfileSuggestion[] = [];

  if (photoCount < MIN_PROFILE_PHOTOS) {
    const missing = MIN_PROFILE_PHOTOS - photoCount;
    essentials.push({
      id: "photos-missing",
      text:
        photoCount === 0
          ? "Sube un par de fotos para que te puedan conocer."
          : `Añade ${missing} ${plural(missing, "foto más", "fotos más")}: con ${MIN_PROFILE_PHOTOS} tu perfil queda listo.`,
      actionLabel: "Añadir fotos",
      href: meRoutes.editPhotos,
      essential: true
    });
  }

  if (tagCount === 0) {
    essentials.push({
      id: "tags-missing",
      text: "Elige alguna etiqueta: es como te encuentra la gente afín.",
      actionLabel: "Elegir etiquetas",
      href: meRoutes.editTags,
      essential: true
    });
  }

  if (bioLength < BIO_MIN_LENGTH) {
    essentials.push({
      id: "bio-missing",
      text:
        bioLength === 0
          ? "Cuenta algo de ti en «Sobre mí». Con un par de frases basta."
          : `Tu «Sobre mí» necesita al menos ${BIO_MIN_LENGTH} caracteres. Ya casi.`,
      actionLabel: "Escribir sobre mí",
      href: meRoutes.editBio,
      essential: true
    });
  }

  const basicsMissing =
    !profile.displayName?.trim() ||
    profile.birthDate === null ||
    profile.gender === null ||
    (profile.lookingFor ?? []).length === 0;

  if (basicsMissing) {
    essentials.push({
      id: "basics-missing",
      text: "Completa lo básico: nombre, edad, género y qué buscas.",
      actionLabel: "Completar lo básico",
      href: meRoutes.editBasics,
      essential: true
    });
  }

  if (essentials.length === 0 && !profile.isComplete) {
    // Lo que queda (a quién quieres conocer, distancia, ubicación) vive en los filtros.
    essentials.push({
      id: "preferences-missing",
      text: "Repasa tus filtros: a quién quieres conocer y a qué distancia.",
      actionLabel: "Ver filtros",
      href: meRoutes.filters,
      essential: true
    });
  }

  if (essentials.length > 0) {
    return {
      tone: "incomplete",
      title: "Casi lo tienes",
      message:
        essentials.length === 1
          ? "Te falta un detalle para aparecer en Descubrir:"
          : "Te faltan un par de detalles para aparecer en Descubrir:",
      suggestions: essentials
    };
  }

  const extras: ProfileSuggestion[] = [];

  if (photoCount < MAX_PROFILE_PHOTOS) {
    const room = MAX_PROFILE_PHOTOS - photoCount;
    extras.push({
      id: "photos-room",
      text: `Tienes hueco para ${room} ${plural(room, "foto más", "fotos más")}.`,
      actionLabel: "Añadir fotos",
      href: meRoutes.editPhotos,
      essential: false
    });
  }

  if (tagCount < COMFORTABLE_TAG_COUNT && tagCount < MAX_POSITIVE_TAGS) {
    extras.push({
      id: "tags-few",
      text: "Con alguna etiqueta más es más fácil dar con gente afín.",
      actionLabel: "Añadir etiquetas",
      href: meRoutes.editTags,
      essential: false
    });
  }

  if (extras.length === 0) {
    return {
      tone: "shining",
      title: "Tu perfil brilla",
      message: "Fotos, etiquetas y bio en su sitio. Ahora a disfrutar.",
      suggestions: []
    };
  }

  return {
    tone: "polish",
    title: "Tu perfil está listo",
    message: "Si te apetece darle un toque más:",
    suggestions: extras
  };
}
