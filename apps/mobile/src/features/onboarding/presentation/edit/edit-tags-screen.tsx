import { useEffect, useRef } from "react";

import type { Tag } from "@snack/contracts";

import { ErrorState, FormMessage, Stack } from "../../../../shared/ui";
import { bindTagEditorApi } from "../../../tags/application/tag-editor-api";
import { TagSaveFailure, useTagEditor } from "../../../tags/application/use-tag-editor";
import { tagsByIds } from "../../../tags/domain/tag-catalog";
import { MIN_POSITIVE_TAGS } from "../../../tags/domain/tag-selection";
import { TagBoard, TagCatalogSkeleton } from "../../../tags/presentation/tag-board";
import { TagSummary } from "../../../tags/presentation/tag-summary";
import { useTagControls } from "../../../tags/presentation/use-tag-controls";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { stepSaveErrorMessage } from "../../application/step-actions";
import { STEP_TONES } from "../step-tones";
import { useProfileDraft, useTagCatalog } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";
import { EditScaffold, toastSaved, useLeaveEdit } from "./edit-scaffold";

function ids(tags: ReadonlyArray<Tag> | null | undefined): string[] {
  return (tags ?? []).map((tag) => tag.id);
}

/**
 * Editar etiquetas: la misma página única del onboarding («+» me gusta, «−»
 * bloquear, nunca las dos a la vez). Se guarda todo junto.
 */
export function EditTagsScreen() {
  const { profile, ready, failed, retry, callApi } = useProfileDraft();
  const { catalog, failed: catalogFailed, retry: retryCatalog } = useTagCatalog();
  const leave = useLeaveEdit();
  const editor = useTagEditor();
  const { reset } = editor;
  const { busy, error, run } = useStepSave();
  const { onPress, likedShakeStyle, blockedShakeStyle } = useTagControls(editor.press);
  const initialized = useRef(false);

  useEffect(() => {
    if (ready && profile && !initialized.current) {
      initialized.current = true;
      reset({ positive: ids(profile.tags), blocked: ids(profile.blockedTags) });
    }
  }, [profile, ready, reset]);

  const likedCount = editor.selection.positive.length;

  const save = () =>
    void run(
      async () => {
        const saved = await editor.save(bindTagEditorApi(callApi));
        useProfileDraftStore.getState().setTags({
          tags: tagsByIds(catalog ?? [], saved.positive),
          blockedTags: tagsByIds(catalog ?? [], saved.blocked)
        });
        toastSaved();
        leave();
      },
      (caught) => (caught instanceof TagSaveFailure ? caught.message : stepSaveErrorMessage(caught))
    );

  const loaded = ready && !!profile && catalog !== null && initialized.current;

  return (
    <EditScaffold
      canSave={likedCount >= MIN_POSITIVE_TAGS}
      dirty={editor.dirty}
      failed={failed}
      loading={!ready}
      onRetry={retry}
      onSave={save}
      saving={busy}
      subheader={
        <TagSummary
          blockedCount={editor.selection.blocked.length}
          blockedShakeStyle={blockedShakeStyle}
          likedCount={likedCount}
          likedShakeStyle={likedShakeStyle}
          testID="edit-tags-summary"
          tone={STEP_TONES.tags}
        />
      }
      testID="edit-tags-screen"
      title="Tus etiquetas"
    >
      <Stack gap="md">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {catalogFailed ? (
          <ErrorState compact message="No hemos podido cargar las etiquetas." onRetry={retryCatalog} testID="edit-tags-error" />
        ) : loaded && catalog ? (
          <TagBoard catalog={catalog} onPress={onPress} selection={editor.selection} testID="edit-tags-board" />
        ) : (
          <TagCatalogSkeleton />
        )}
      </Stack>
    </EditScaffold>
  );
}
