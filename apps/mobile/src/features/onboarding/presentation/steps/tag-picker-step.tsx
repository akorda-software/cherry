import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import type { Tag } from "@snack/contracts";

import { ErrorState, FormMessage } from "../../../../shared/ui";
import { bindTagEditorApi } from "../../../tags/application/tag-editor-api";
import { TagSaveFailure, useTagEditor } from "../../../tags/application/use-tag-editor";
import { tagsByIds } from "../../../tags/domain/tag-catalog";
import { MIN_POSITIVE_TAGS } from "../../../tags/domain/tag-selection";
import { TagBoard, TagCatalogSkeleton } from "../../../tags/presentation/tag-board";
import { TagSummary } from "../../../tags/presentation/tag-summary";
import { useTagControls } from "../../../tags/presentation/use-tag-controls";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { stepSaveErrorMessage } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import { StepPage } from "../step-page";
import { STEP_TONES } from "../step-tones";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft, useTagCatalog } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";

function ids(tags: ReadonlyArray<Tag> | null | undefined): string[] {
  return (tags ?? []).map((tag) => tag.id);
}

/**
 * Paso de etiquetas: una sola página con todo el catálogo. En cada etiqueta,
 * «+» la marca como tuya (3–8, obligatorio) y «−» la bloquea (0–5, opcional).
 * Una etiqueta nunca puede estar en las dos listas; se guarda sin conflictos.
 */
export function TagsStep() {
  const step = "tags";
  const { profile, ready, callApi } = useProfileDraft();
  const { catalog, failed, retry } = useTagCatalog();
  const navigation = useOnboardingNavigation();
  const editor = useTagEditor();
  const { busy, error, run } = useStepSave();
  const { onPress, likedShakeStyle, blockedShakeStyle } = useTagControls(editor.press);
  const initialized = useRef(false);
  const { reset } = editor;

  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      reset({ positive: ids(profile?.tags), blocked: ids(profile?.blockedTags) });
    }
  }, [profile?.blockedTags, profile?.tags, ready, reset]);

  const submit = () =>
    void run(
      async () => {
        if (editor.dirty) {
          const saved = await editor.save(bindTagEditorApi(callApi));
          useProfileDraftStore.getState().setTags({
            tags: tagsByIds(catalog ?? [], saved.positive),
            blockedTags: tagsByIds(catalog ?? [], saved.blocked)
          });
        }

        navigation.goNext(step);
      },
      (caught) => (caught instanceof TagSaveFailure ? caught.message : stepSaveErrorMessage(caught))
    );

  const loaded = ready && catalog !== null;
  const likedCount = editor.selection.positive.length;

  useStepCta(step, {
    enabled: loaded && likedCount >= MIN_POSITIVE_TAGS,
    busy,
    label: "Continuar",
    testID: "onboarding-cta-tags",
    onPress: submit
  });

  return (
    <StepPage
      step={step}
      sticky={
        <TagSummary
          blockedCount={editor.selection.blocked.length}
          blockedShakeStyle={blockedShakeStyle}
          likedCount={likedCount}
          likedShakeStyle={likedShakeStyle}
          testID="tag-summary"
          tone={STEP_TONES[step]}
        />
      }
      testID="onboarding-step-tags"
      title="Tus etiquetas"
    >
      <View style={styles.body}>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {failed ? (
          <ErrorState
            compact
            message="No hemos podido cargar las etiquetas. Revisa tu conexión."
            onRetry={retry}
            testID="onboarding-tags-error"
          />
        ) : loaded && catalog ? (
          <TagBoard catalog={catalog} onPress={onPress} selection={editor.selection} testID="tag-board" />
        ) : (
          <TagCatalogSkeleton />
        )}
      </View>
    </StepPage>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 16
  }
});
