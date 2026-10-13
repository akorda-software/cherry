import { useEffect, useState } from "react";

import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveBio, stepSaveErrorMessage } from "../../application/step-actions";
import { validateBio } from "../../domain/profile-fields";
import { BioNote } from "../fields/bio-note";
import { useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";
import { EditScaffold, toastSaved, useLeaveEdit } from "./edit-scaffold";

/** Editar la descripción («Sobre mí»): el mismo campo del onboarding. */
export function EditBioScreen() {
  const { profile, ready, failed, retry, callApi } = useProfileDraft();
  const leave = useLeaveEdit();
  const { busy, error, setError, run } = useStepSave();
  const [bio, setBio] = useState<string | null>(null);

  useEffect(() => {
    if (ready && bio === null) {
      setBio(profile?.bio ?? "");
    }
  }, [bio, profile?.bio, ready]);

  const value = bio ?? "";
  const validation = validateBio(value);
  const dirty = bio !== null && value.trim() !== (profile?.bio ?? "").trim();

  const save = () =>
    void run(async () => {
      const saved = await callApi((api) => saveBio(api, value));
      useProfileDraftStore.getState().setProfile(saved);
      toastSaved();
      leave();
    }, stepSaveErrorMessage);

  return (
    <EditScaffold
      canSave={validation.ok}
      dirty={dirty}
      failed={failed}
      loading={!ready || bio === null}
      onRetry={retry}
      onSave={save}
      saving={busy}
      testID="edit-bio-screen"
      title="Sobre mí"
      tone="cielo"
    >
      <BioNote
        error={error}
        onChange={(next) => {
          setBio(next);
          if (error) setError(null);
        }}
        testID="edit-bio"
        value={value}
      />
    </EditScaffold>
  );
}
