import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { Tag } from "@snack/contracts";

import { ErrorState, FormMessage, SegmentedControl, Stack, useTheme } from "../../../../shared/ui";
import { bindTagEditorApi } from "../../../tags/application/tag-editor-api";
import { TagSaveFailure, useTagEditor } from "../../../tags/application/use-tag-editor";
import { tagsByIds } from "../../../tags/domain/tag-catalog";
import { MAX_BLOCKED_TAGS, MAX_POSITIVE_TAGS, MIN_POSITIVE_TAGS, type TagKind } from "../../../tags/domain/tag-selection";
import { TagBoard } from "../../../tags/presentation/tag-board";
import { TagShelf } from "../../../tags/presentation/tag-shelf";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { stepSaveErrorMessage } from "../../application/step-actions";
import { blockedTagsStatus, positiveTagsStatus } from "../../../tags/domain/tag-status";
import { TagCatalogSkeleton, useShelfNotice } from "../steps/tag-picker-step";
import { useProfileDraft, useTagCatalog } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";
import { EditScaffold, toastSaved, useLeaveEdit } from "./edit-scaffold";

function ids(tags: ReadonlyArray<Tag> | null | undefined): string[] {
  return (tags ?? []).map((tag) => tag.id);
}

/**
 * Editar etiquetas: «Así soy yo» y «No va conmigo» en pestañas sobre la misma
 * selección (una etiqueta nunca puede estar en las dos). Se guarda todo junto.
 */
export function EditTagsScreen() {
  const theme = useTheme();
  const { profile, ready, failed, retry, callApi } = useProfileDraft();
  const { catalog, failed: catalogFailed, retry: retryCatalog } = useTagCatalog();
  const leave = useLeaveEdit();
  const editor = useTagEditor();
  const { reset } = editor;
  const { busy, error, run } = useStepSave();
  const { notice, flash, clear, shakeStyle } = useShelfNotice();
  const [tab, setTab] = useState<TagKind>("positive");
  const initialized = useRef(false);

  useEffect(() => {
    if (ready && profile && !initialized.current) {
      initialized.current = true;
      reset({ positive: ids(profile.tags), blocked: ids(profile.blockedTags) });
    }
  }, [profile, ready, reset]);

  const positive = tab === "positive";
  const list = positive ? editor.selection.positive : editor.selection.blocked;
  const shelfTags = useMemo(() => tagsByIds(catalog ?? [], list), [catalog, list]);
  const positiveCount = editor.selection.positive.length;

  const onToggle = (tag: Tag) => {
    const outcome = editor.toggle(tab, tag.id);

    if (outcome.type === "limit_reached") {
      flash(positive ? "Máximo 8: despega una para pegar otra." : "Máximo 5: quita una para añadir otra.");
    } else if (outcome.type === "conflict") {
      flash("Es una de las tuyas: quítala primero de tus etiquetas.");
    } else {
      clear();
    }
  };

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
      canSave={positiveCount >= MIN_POSITIVE_TAGS}
      dirty={editor.dirty}
      failed={failed}
      loading={!ready}
      onRetry={retry}
      onSave={save}
      saving={busy}
      subheader={
        <View style={[styles.subheader, { backgroundColor: theme.semantic.color.screenBackground }]}>
          <View style={{ paddingHorizontal: theme.semantic.layout.screenPadding }}>
            <SegmentedControl
              accessibilityLabel="Tipo de etiquetas"
              fullWidth
              onChange={(value) => {
                setTab(value);
                clear();
              }}
              options={[
                { value: "positive", label: "Así soy yo", icon: "heart", testID: "edit-tags-tab-positive" },
                { value: "blocked", label: "No va conmigo", icon: "block", testID: "edit-tags-tab-blocked" }
              ]}
              value={tab}
            />
          </View>
          <TagShelf
            kind={tab}
            max={positive ? MAX_POSITIVE_TAGS : MAX_BLOCKED_TAGS}
            onRemove={onToggle}
            shakeStyle={shakeStyle}
            status={notice ?? (positive ? positiveTagsStatus(list.length) : blockedTagsStatus(list.length))}
            tags={shelfTags}
            testID={positive ? "edit-tags-shelf" : "edit-blocked-shelf"}
            tone={positive ? "limonada" : "lavanda"}
            warning={notice !== null}
          />
        </View>
      }
      testID="edit-tags-screen"
      title="Tus etiquetas"
    >
      <Stack gap="md">
        {!positive ? (
          <FormMessage tone="info">No verás a personas con estas etiquetas, ni ellas a ti. Sin dramas.</FormMessage>
        ) : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {catalogFailed ? (
          <ErrorState compact message="No hemos podido cargar las etiquetas." onRetry={retryCatalog} testID="edit-tags-error" />
        ) : loaded && catalog ? (
          <TagBoard catalog={catalog} kind={tab} onToggle={onToggle} stateOf={editor.stateOf} testID="edit-tags-board" />
        ) : (
          <TagCatalogSkeleton />
        )}
      </Stack>
    </EditScaffold>
  );
}

const styles = StyleSheet.create({
  subheader: {
    gap: 12,
    paddingTop: 4
  }
});
