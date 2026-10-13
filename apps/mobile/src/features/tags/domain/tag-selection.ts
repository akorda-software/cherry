import { MAX_BLOCKED_TAGS, MAX_POSITIVE_TAGS } from "@cherry/contracts";

export { MAX_BLOCKED_TAGS, MAX_POSITIVE_TAGS };

/** Mínimo para continuar en el onboarding (backend admite 1; menos de 3 dice poco de ti). */
export const MIN_POSITIVE_TAGS = 3;
/**
 * Lo que exige el backend para dar el perfil por completo. Al REANUDAR el onboarding basta con
 * esto: quien ya tiene 1 o 2 etiquetas no rebota al paso de etiquetas (si pasa por él, la UI
 * sigue pidiendo `MIN_POSITIVE_TAGS` para continuar).
 */
export const BACKEND_MIN_POSITIVE_TAGS = 1;
/** A partir de aquí el perfil ya se entiende bien de un vistazo. */
export const RECOMMENDED_POSITIVE_TAGS = 5;

export type TagKind = "positive" | "blocked";
export type TagSelectionState = "neutral" | "liked" | "blocked";

export interface TagSelection {
  positive: string[];
  blocked: string[];
}

export const EMPTY_TAG_SELECTION: TagSelection = { positive: [], blocked: [] };

export interface TagLimits {
  maxPositive: number;
  maxBlocked: number;
}

export const DEFAULT_TAG_LIMITS: TagLimits = { maxPositive: MAX_POSITIVE_TAGS, maxBlocked: MAX_BLOCKED_TAGS };

/**
 * Qué pasa al tocar una etiqueta que está en la OTRA lista:
 * - `move`: se cambia de lista (elegir como tuya una que bloqueabas la desbloquea).
 * - `reject`: no se toca y se avisa (no se puede bloquear una etiqueta tuya).
 */
export type ConflictPolicy = "move" | "reject";

export type ToggleOutcome =
  | { type: "added" }
  | { type: "removed" }
  | { type: "moved" }
  | { type: "limit_reached"; limit: number }
  | { type: "conflict" };

export interface ToggleResult {
  selection: TagSelection;
  outcome: ToggleOutcome;
}

export function tagStateOf(selection: TagSelection, tagId: string): TagSelectionState {
  if (selection.positive.includes(tagId)) {
    return "liked";
  }

  return selection.blocked.includes(tagId) ? "blocked" : "neutral";
}

function listOf(selection: TagSelection, kind: TagKind): string[] {
  return kind === "positive" ? selection.positive : selection.blocked;
}

function withList(selection: TagSelection, kind: TagKind, ids: string[]): TagSelection {
  return kind === "positive" ? { ...selection, positive: ids } : { ...selection, blocked: ids };
}

/** Pone o quita `tagId` en la lista `kind` respetando límites y conflictos. Puro. */
export function toggleTag(
  selection: TagSelection,
  kind: TagKind,
  tagId: string,
  {
    limits = DEFAULT_TAG_LIMITS,
    onConflict = kind === "positive" ? "move" : "reject"
  }: { limits?: TagLimits; onConflict?: ConflictPolicy } = {}
): ToggleResult {
  const own = listOf(selection, kind);
  const otherKind: TagKind = kind === "positive" ? "blocked" : "positive";
  const other = listOf(selection, otherKind);
  const limit = kind === "positive" ? limits.maxPositive : limits.maxBlocked;

  if (own.includes(tagId)) {
    return {
      selection: withList(
        selection,
        kind,
        own.filter((id) => id !== tagId)
      ),
      outcome: { type: "removed" }
    };
  }

  const inOther = other.includes(tagId);

  if (inOther && onConflict === "reject") {
    return { selection, outcome: { type: "conflict" } };
  }

  if (own.length >= limit) {
    return { selection, outcome: { type: "limit_reached", limit } };
  }

  const added = withList(selection, kind, [...own, tagId]);

  if (!inOther) {
    return { selection: added, outcome: { type: "added" } };
  }

  return {
    selection: withList(
      added,
      otherKind,
      other.filter((id) => id !== tagId)
    ),
    outcome: { type: "moved" }
  };
}

/**
 * Página única de etiquetas: cada una lleva «+» (me gusta, `positive`) y «−»
 * (bloquear, `blocked`).
 * - Neutral + control → pasa a esa lista (si no está llena).
 * - Tocar el control que ya está activo → vuelve a neutral.
 * - Tocar el otro control → cambia de lista (si la de destino no está llena;
 *   si lo está, no se toca nada).
 * Por construcción una etiqueta nunca queda en las dos listas.
 */
export function pressTagControl(
  selection: TagSelection,
  kind: TagKind,
  tagId: string,
  limits: TagLimits = DEFAULT_TAG_LIMITS
): ToggleResult {
  return toggleTag(selection, kind, tagId, { limits, onConflict: "move" });
}

/** Quita de la selección ids que ya no existen en el catálogo (o que backend rechazó). */
export function withoutTagIds(selection: TagSelection, ids: ReadonlyArray<string>): TagSelection {
  if (ids.length === 0) {
    return selection;
  }

  const drop = new Set(ids);
  return {
    positive: selection.positive.filter((id) => !drop.has(id)),
    blocked: selection.blocked.filter((id) => !drop.has(id))
  };
}

export function sameTagIds(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function sameTagSelection(a: TagSelection, b: TagSelection): boolean {
  return sameTagIds(a.positive, b.positive) && sameTagIds(a.blocked, b.blocked);
}
