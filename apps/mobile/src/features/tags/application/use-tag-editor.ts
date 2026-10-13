import { useCallback, useMemo, useRef, useState } from "react";

import type { Tag } from "@cherry/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import { executeTagSave, parseTagSaveError, planTagSave, type TagSaveErrorCode } from "../domain/tag-save-plan";
import {
  DEFAULT_TAG_LIMITS,
  EMPTY_TAG_SELECTION,
  pressTagControl,
  sameTagSelection,
  tagStateOf,
  toggleTag,
  withoutTagIds,
  type ConflictPolicy,
  type TagKind,
  type TagLimits,
  type TagSelection,
  type TagSelectionState,
  type ToggleOutcome
} from "../domain/tag-selection";

export interface TagEditorApi {
  setPositiveTags(tagIds: string[]): Promise<Tag[]>;
  setBlockedTags(tagIds: string[]): Promise<Tag[]>;
  getPositiveTags(): Promise<Tag[]>;
  getBlockedTags(): Promise<Tag[]>;
}

/** Error de guardado ya traducido: `message` se puede enseñar tal cual. */
export class TagSaveFailure extends Error {
  readonly code: TagSaveErrorCode;
  readonly tagIds: string[];

  constructor(code: TagSaveErrorCode, message: string, tagIds: string[] = [], cause?: unknown) {
    super(message);
    this.name = "TagSaveFailure";
    this.code = code;
    this.tagIds = tagIds;
    (this as { cause?: unknown }).cause = cause;
  }
}

export function tagSaveFailureMessage(code: TagSaveErrorCode, cause: unknown): string {
  switch (code) {
    case "invalid_tags":
      return "Alguna etiqueta ya no está en el catálogo y la hemos quitado. Échale un ojo y vuelve a guardar.";
    case "tag_conflict":
      return "Una etiqueta no puede ser tuya y estar bloqueada a la vez. Lo hemos ordenado: revisa y guarda otra vez.";
    case "too_many_tags":
      return "Te has pasado del máximo de etiquetas. Quita alguna y vuelve a probar.";
    case "unknown":
      return friendlyErrorMessage(cause, "No hemos podido guardar tus etiquetas. Inténtalo otra vez.");
  }
}

function ids(tags: ReadonlyArray<Tag>): string[] {
  return tags.map((tag) => tag.id);
}

export interface UseTagEditorOptions {
  initial?: TagSelection;
  limits?: TagLimits;
}

export interface UseTagEditorResult {
  selection: TagSelection;
  /** Lo que backend tiene guardado (según la última respuesta). */
  server: TagSelection;
  dirty: boolean;
  limits: TagLimits;
  stateOf(tagId: string): TagSelectionState;
  /** Aplica el toque y devuelve qué ha pasado (para animar, vibrar o avisar). */
  toggle(kind: TagKind, tagId: string, onConflict?: ConflictPolicy): ToggleOutcome;
  /**
   * «+» (`positive`) o «−» (`blocked`) de la página única: activa, desactiva o
   * cambia de lista (ver `pressTagControl`). Referencia estable.
   */
  press(kind: TagKind, tagId: string): ToggleOutcome;
  /** Sustituye servidor y selección (tras cargar de backend). */
  reset(server: TagSelection): void;
  /** Guarda sin conflictos transitorios; lanza `TagSaveFailure` con mensaje amable. */
  save(api: TagEditorApi): Promise<TagSelection>;
}

export function useTagEditor({ initial = EMPTY_TAG_SELECTION, limits = DEFAULT_TAG_LIMITS }: UseTagEditorOptions = {}): UseTagEditorResult {
  const [selection, setSelectionState] = useState<TagSelection>(initial);
  const [server, setServerState] = useState<TagSelection>(initial);
  // Espejos síncronos: `toggle` devuelve el resultado en el mismo toque.
  const selectionRef = useRef(selection);
  const serverRef = useRef(server);

  const setSelection = useCallback((next: TagSelection) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);

  const setServer = useCallback((next: TagSelection) => {
    serverRef.current = next;
    setServerState(next);
  }, []);

  const toggle = useCallback(
    (kind: TagKind, tagId: string, onConflict?: ConflictPolicy) => {
      const result = toggleTag(selectionRef.current, kind, tagId, { limits, onConflict });

      if (result.selection !== selectionRef.current) {
        setSelection(result.selection);
      }

      return result.outcome;
    },
    [limits, setSelection]
  );

  const press = useCallback(
    (kind: TagKind, tagId: string) => {
      const result = pressTagControl(selectionRef.current, kind, tagId, limits);

      if (result.selection !== selectionRef.current) {
        setSelection(result.selection);
      }

      return result.outcome;
    },
    [limits, setSelection]
  );

  const reset = useCallback(
    (next: TagSelection) => {
      setServer(next);
      setSelection(next);
    },
    [setSelection, setServer]
  );

  const save = useCallback(
    async (api: TagEditorApi) => {
      const target = selectionRef.current;
      const plan = planTagSave(serverRef.current, target);

      try {
        await executeTagSave(api, plan, (kind, tags) => {
          setServer({ ...serverRef.current, [kind]: ids(tags) });
        });
      } catch (error) {
        const parsed = parseTagSaveError(error);

        if (parsed.code === "invalid_tags" || parsed.code === "tag_conflict") {
          // Nuestra foto del servidor puede estar desfasada: se rehace y se quitan
          // de la selección las etiquetas problemáticas.
          try {
            const [positive, blocked] = await Promise.all([api.getPositiveTags(), api.getBlockedTags()]);
            setServer({ positive: ids(positive), blocked: ids(blocked) });
          } catch {
            // Si tampoco se puede recargar, el siguiente intento lo dirá.
          }

          setSelection(withoutTagIds(selectionRef.current, parsed.tagIds));
        }

        throw new TagSaveFailure(parsed.code, tagSaveFailureMessage(parsed.code, error), parsed.tagIds, error);
      }

      setServer(target);
      return target;
    },
    [setSelection, setServer]
  );

  const stateOf = useCallback((tagId: string) => tagStateOf(selection, tagId), [selection]);
  const dirty = useMemo(() => !sameTagSelection(selection, server), [selection, server]);

  return { selection, server, dirty, limits, stateOf, toggle, press, reset, save };
}
