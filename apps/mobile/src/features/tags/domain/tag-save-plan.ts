import type { Tag } from "@snack/contracts";

import { sameTagIds, type TagKind, type TagSelection } from "./tag-selection";

/**
 * Backend rechaza (`tag_conflict`) guardar una etiqueta positiva que está
 * bloqueada o al revés, comparando con lo que YA tiene guardado. Para pasar
 * de (P0, B0) a (P1, B1) sin conflictos transitorios hay que elegir el orden
 * de los `PUT` (y a veces hacer uno intermedio).
 */
export interface TagSaveOperation {
  kind: TagKind;
  ids: string[];
}

function disjoint(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  const set = new Set(b);
  return a.every((id) => !set.has(id));
}

export function planTagSave(server: TagSelection, next: TagSelection): TagSaveOperation[] {
  const positiveChanged = !sameTagIds(server.positive, next.positive);
  const blockedChanged = !sameTagIds(server.blocked, next.blocked);

  if (!positiveChanged && !blockedChanged) {
    return [];
  }

  if (!blockedChanged) {
    return [{ kind: "positive", ids: next.positive }];
  }

  if (!positiveChanged) {
    return [{ kind: "blocked", ids: next.blocked }];
  }

  if (disjoint(next.positive, server.blocked)) {
    return [
      { kind: "positive", ids: next.positive },
      { kind: "blocked", ids: next.blocked }
    ];
  }

  if (disjoint(next.blocked, server.positive)) {
    return [
      { kind: "blocked", ids: next.blocked },
      { kind: "positive", ids: next.positive }
    ];
  }

  // Intercambio en los dos sentidos: primero las positivas que no chocan, luego
  // las bloqueadas y al final el resto de positivas.
  const serverBlocked = new Set(server.blocked);
  return [
    { kind: "positive", ids: next.positive.filter((id) => !serverBlocked.has(id)) },
    { kind: "blocked", ids: next.blocked },
    { kind: "positive", ids: next.positive }
  ];
}

export interface TagSaveApi {
  setPositiveTags(tagIds: string[]): Promise<Tag[]>;
  setBlockedTags(tagIds: string[]): Promise<Tag[]>;
}

/**
 * Ejecuta el plan en orden. `onApplied` recibe lo que backend confirma tras cada
 * `PUT`, para que quien llama mantenga su foto del servidor aunque falle uno
 * posterior (el error se relanza tal cual).
 */
export async function executeTagSave(
  api: TagSaveApi,
  operations: ReadonlyArray<TagSaveOperation>,
  onApplied?: (kind: TagKind, tags: Tag[]) => void
): Promise<void> {
  for (const operation of operations) {
    const tags =
      operation.kind === "positive"
        ? await api.setPositiveTags(operation.ids)
        : await api.setBlockedTags(operation.ids);
    onApplied?.(operation.kind, tags);
  }
}

export type TagSaveErrorCode = "invalid_tags" | "tag_conflict" | "too_many_tags" | "unknown";

export interface ParsedTagSaveError {
  code: TagSaveErrorCode;
  /** Ids que backend señala (`tagIds` en `invalid_tags` / `tag_conflict`). */
  tagIds: string[];
}

/** Lee un error del `HttpClient` de la app (`code` = `body.error`, `body.tagIds`). */
export function parseTagSaveError(error: unknown): ParsedTagSaveError {
  const candidate = error as { code?: unknown; message?: unknown; body?: unknown } | null;
  const body = (candidate?.body ?? null) as { error?: unknown; tagIds?: unknown } | null;
  const rawCode = typeof candidate?.code === "string" ? candidate.code : typeof body?.error === "string" ? body.error : null;
  const tagIds = Array.isArray(body?.tagIds) ? body.tagIds.filter((id): id is string => typeof id === "string") : [];

  switch (rawCode) {
    case "invalid_tags":
    case "tag_conflict":
      return { code: rawCode, tagIds };
    case "too_many_tags":
    case "too_many_blocked_tags":
      return { code: "too_many_tags", tagIds };
    default:
      return { code: "unknown", tagIds };
  }
}
