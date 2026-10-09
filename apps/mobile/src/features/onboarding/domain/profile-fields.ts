import type { Gender, RelationshipIntent } from "@snack/contracts";

/** Reglas de los campos del perfil (espejo de `Snack.Dating.Profile` en backend). */
export const DISPLAY_NAME_MAX = 50;
export const BIO_MIN = 20;
export const BIO_MAX = 240;

export const GENDERS: ReadonlyArray<Gender> = ["man", "woman", "non_binary"];
export const RELATIONSHIP_INTENTS: ReadonlyArray<RelationshipIntent> = [
  "relationship",
  "casual",
  "meet_people",
  "go_with_the_flow"
];

export function isGender(value: unknown): value is Gender {
  return typeof value === "string" && (GENDERS as readonly string[]).includes(value);
}

export function isRelationshipIntent(value: unknown): value is RelationshipIntent {
  return typeof value === "string" && (RELATIONSHIP_INTENTS as readonly string[]).includes(value);
}

/** «¿Qué buscas?» admite hasta todas las intenciones (el backend exige 1–4, sin repetir). */
export const MIN_INTENTS = 1;

/**
 * Intenciones válidas de un valor cualquiera (`lookingFor`, o una sola cadena antigua),
 * sin repetir y en el orden canónico, que es como las guarda el backend.
 */
export function normalizeIntents(value: unknown): RelationshipIntent[] {
  const list: unknown[] = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return RELATIONSHIP_INTENTS.filter((intent) => list.includes(intent));
}

/** Marca o desmarca una intención; el resultado queda en orden canónico. */
export function toggleIntent(current: ReadonlyArray<RelationshipIntent>, intent: RelationshipIntent): RelationshipIntent[] {
  const next = current.includes(intent) ? current.filter((value) => value !== intent) : [...current, intent];
  return normalizeIntents(next);
}

/** Misma selección, sin importar el orden. */
export function sameIntents(a: ReadonlyArray<RelationshipIntent>, b: ReadonlyArray<RelationshipIntent>): boolean {
  return a.length === b.length && a.every((intent) => b.includes(intent));
}

interface GraphemeSegmenter {
  segment(input: string): Iterable<unknown>;
}

type SegmenterConstructor = new (locale?: string, options?: { granularity: "grapheme" }) => GraphemeSegmenter;

let graphemeSegmenter: GraphemeSegmenter | null | undefined;

/**
 * Longitud en grafemas (lo que ve la persona y lo que cuenta el backend con
 * `String.length`). Sin `Intl.Segmenter` (Hermes) cae a puntos de código, que
 * nunca cuentan de menos.
 */
export function graphemeCount(value: string): number {
  if (graphemeSegmenter === undefined) {
    const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
    graphemeSegmenter = Segmenter ? new Segmenter("es", { granularity: "grapheme" }) : null;
  }

  if (graphemeSegmenter === null) {
    return [...value].length;
  }

  let count = 0;
  for (const _segment of graphemeSegmenter.segment(value)) {
    count += 1;
  }
  return count;
}

/** Colapsa espacios repetidos y recorta: «  Lucía   María » → «Lucía María». */
export function normalizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export type DisplayNameValidation = { ok: true; value: string } | { ok: false; reason: "empty" | "too_long" };

export function validateDisplayName(raw: string | null | undefined): DisplayNameValidation {
  const value = normalizeDisplayName(raw ?? "");

  if (value.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (graphemeCount(value) > DISPLAY_NAME_MAX) {
    return { ok: false, reason: "too_long" };
  }

  return { ok: true, value };
}

/**
 * Nombre sugerido a partir del de la cuenta (Google/Apple): solo la primera
 * palabra y solo si parece un nombre (letras, apóstrofo o guion). Así un
 * «nuevo+123» del login de pruebas no acaba precargado.
 */
export function suggestedFirstName(accountName: string | null | undefined): string {
  const first = normalizeDisplayName(accountName ?? "").split(" ")[0] ?? "";
  return /^\p{L}[\p{L}'’-]{0,24}$/u.test(first) ? first : "";
}

export function bioLength(raw: string | null | undefined): number {
  return graphemeCount((raw ?? "").trim());
}

export type BioValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "too_short" | "too_long"; length: number };

export function validateBio(raw: string | null | undefined): BioValidation {
  const value = (raw ?? "").trim();
  const length = bioLength(value);

  if (length < BIO_MIN) {
    return { ok: false, reason: "too_short", length };
  }

  if (length > BIO_MAX) {
    return { ok: false, reason: "too_long", length };
  }

  return { ok: true, value };
}

/** Arranques de bio: rompen el bloqueo de la página en blanco. */
export const BIO_STARTERS: ReadonlyArray<string> = [
  "Mi domingo perfecto es…",
  "Me ganas si…",
  "Dos verdades y una mentira:",
  "Busco a alguien con quien…"
];

/**
 * Inserta un arranque al final de la bio (en línea nueva si ya hay texto) sin
 * pasarse del máximo. Devuelve el texto tal cual si no cabe.
 */
export function insertBioStarter(current: string, starter: string, max = BIO_MAX): string {
  const base = current.replace(/\s+$/u, "");
  const next = base.length === 0 ? `${starter} ` : `${base}\n${starter} `;
  return graphemeCount(next.trim()) > max ? current : next;
}
