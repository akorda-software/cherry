import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import type { Tag } from "@snack/contracts";

import { ErrorState, FormMessage, haptics, Inline, Skeleton, SkeletonGroup, Stack, useShake } from "../../../../shared/ui";
import { bindTagEditorApi } from "../../../tags/application/tag-editor-api";
import { TagSaveFailure, useTagEditor } from "../../../tags/application/use-tag-editor";
import { tagsByIds } from "../../../tags/domain/tag-catalog";
import { MAX_BLOCKED_TAGS, MAX_POSITIVE_TAGS, MIN_POSITIVE_TAGS, sameTagSelection, type TagKind } from "../../../tags/domain/tag-selection";
import { blockedTagsStatus, positiveTagsStatus } from "../../../tags/domain/tag-status";
import { TagBoard } from "../../../tags/presentation/tag-board";
import { TagShelf } from "../../../tags/presentation/tag-shelf";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { stepSaveErrorMessage } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import { StepPage } from "../step-page";
import { STEP_TONES } from "../step-tones";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft, useTagCatalog } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";

/** Aviso pasajero (límite o conflicto) con sacudida amable del estante. */
export function useShelfNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { shake, style } = useShake({ distance: 6, haptic: false });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const flash = (message: string) => {
    setNotice(message);
    shake();
    haptics.warning();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 2800);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  };

  return { notice, flash, clear, shakeStyle: style };
}

function ids(tags: ReadonlyArray<Tag> | null | undefined): string[] {
  return (tags ?? []).map((tag) => tag.id);
}

export function TagCatalogSkeleton() {
  return (
    <SkeletonGroup>
      <Stack gap="lg">
        {[0, 1].map((section) => (
          <Stack gap="sm" key={section}>
            <Skeleton height={22} radius={8} width={140} />
            <Inline gap="sm">
              {[92, 120, 80, 104, 136, 88, 110].map((width, index) => (
                <Skeleton height={38} key={index} radius={19} width={width} />
              ))}
            </Inline>
          </Stack>
        ))}
      </Stack>
    </SkeletonGroup>
  );
}

/**
 * Pasos 7 y 8: etiquetas que te definen (3–8) y etiquetas que no van contigo
 * (0–5, opcional). Mismo tablero de pegatinas; guardado sin conflictos.
 */
export function TagPickerStep({ kind }: { kind: TagKind }) {
  const step = kind === "positive" ? "tags" : "blocked-tags";
  const positive = kind === "positive";
  const { profile, ready, callApi } = useProfileDraft();
  const { catalog, failed, retry } = useTagCatalog();
  const navigation = useOnboardingNavigation();
  const editor = useTagEditor();
  const { busy, error, run } = useStepSave();
  const { notice, flash, clear, shakeStyle } = useShelfNotice();
  const initialized = useRef(false);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const { reset } = editor;

  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      reset({ positive: ids(profile?.tags), blocked: ids(profile?.blockedTags) });
    }
  }, [profile?.blockedTags, profile?.tags, ready, reset]);

  // Al volver a este paso (p. ej. tras bloquear etiquetas en el siguiente), se
  // parte de lo que hay guardado: así nunca se intenta guardar un conflicto.
  useFocusEffect(
    useCallback(() => {
      const saved = useProfileDraftStore.getState().profile;
      const current = editorRef.current;

      if (!saved || !initialized.current || current.dirty) {
        return;
      }

      const next = { positive: ids(saved.tags), blocked: ids(saved.blockedTags) };

      if (!sameTagSelection(next, current.server)) {
        reset(next);
      }
    }, [reset])
  );

  const list = positive ? editor.selection.positive : editor.selection.blocked;
  const shelfTags = useMemo(() => tagsByIds(catalog ?? [], list), [catalog, list]);
  const max = positive ? MAX_POSITIVE_TAGS : MAX_BLOCKED_TAGS;

  const onToggle = (tag: Tag) => {
    const outcome = editor.toggle(kind, tag.id);

    if (outcome.type === "limit_reached") {
      flash(positive ? "Máximo 8: despega una para pegar otra." : "Máximo 5: quita una para añadir otra.");
    } else if (outcome.type === "conflict") {
      flash("Es una de las tuyas: no se puede bloquear.");
    } else {
      clear();
    }
  };

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
  const count = list.length;

  useStepCta(step, {
    enabled: loaded && (!positive || count >= MIN_POSITIVE_TAGS),
    busy,
    label: positive || count > 0 || editor.dirty ? "Continuar" : "Saltar",
    testID: positive ? "onboarding-cta-tags" : "onboarding-cta-blocked-tags",
    onPress: submit
  });

  return (
    <StepPage
      step={step}
      sticky={
        <TagShelf
          kind={kind}
          max={max}
          onRemove={(tag) => onToggle(tag)}
          shakeStyle={shakeStyle}
          status={notice ?? (positive ? positiveTagsStatus(count) : blockedTagsStatus(count))}
          tags={shelfTags}
          testID={positive ? "tag-shelf" : "blocked-shelf"}
          tone={STEP_TONES[step]}
          warning={notice !== null}
        />
      }
      subtitle={
        positive
          ? "Elige de 3 a 8 etiquetas que te definan. Son lo primero que verá la gente (y lo que más os une)."
          : "No verás a personas con estas etiquetas, ni ellas a ti. Sin dramas."
      }
      testID={positive ? "onboarding-step-tags" : "onboarding-step-blocked-tags"}
      title={positive ? "Así soy yo" : "¿Algo que no va contigo?"}
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
          <TagBoard
            catalog={catalog}
            kind={kind}
            onToggle={onToggle}
            stateOf={editor.stateOf}
            testID={positive ? "tag-board" : "blocked-board"}
          />
        ) : (
          <TagCatalogSkeleton />
        )}
      </View>
    </StepPage>
  );
}

export function TagsStep() {
  return <TagPickerStep kind="positive" />;
}

export function BlockedTagsStep() {
  return <TagPickerStep kind="blocked" />;
}

const styles = StyleSheet.create({
  body: {
    gap: 16
  }
});
