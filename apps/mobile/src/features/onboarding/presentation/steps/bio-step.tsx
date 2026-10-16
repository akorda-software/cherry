import { useEffect, useState } from "react";

import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveBio } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import { BIO_MIN, validateBio } from "../../domain/profile-fields";
import { BioNote } from "../fields/bio-note";
import { StepPage } from "../step-page";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";

/** Paso 9: la descripción (20–240 caracteres), con ideas opcionales para empezar. */
export function BioStep() {
  // El estado vive en `BioForm`: al escribir solo se repintan el campo y el contador, no la página.
  return (
    <StepPage
      step="bio"
      subtitle={`Unas líneas sobre ti. Mínimo ${BIO_MIN} caracteres.`}
      testID="onboarding-step-bio"
      title="Tu descripción"
    >
      <BioForm />
    </StepPage>
  );
}

function BioForm() {
  const { profile, ready, callApi } = useProfileDraft();
  const navigation = useOnboardingNavigation();
  const { busy, error, setError, run } = useStepSave();
  const [bio, setBio] = useState<string | null>(null);

  useEffect(() => {
    if (ready && bio === null) {
      setBio(profile?.bio ?? "");
    }
  }, [bio, profile?.bio, ready]);

  const value = bio ?? "";
  const validation = validateBio(value);

  const submit = () =>
    void run(async () => {
      if (!validation.ok) {
        return;
      }

      if (validation.value !== profile?.bio) {
        const saved = await callApi((api) => saveBio(api, value));
        useProfileDraftStore.getState().setProfile(saved);
      }

      navigation.goNext("bio");
    });

  useStepCta("bio", { enabled: ready && validation.ok, busy, onPress: submit });

  return (
    <BioNote
      editable={ready && !busy}
      error={error}
      length={validation.length}
      onChange={(next) => {
        setBio(next);
        if (error) setError(null);
      }}
      testID="onboarding-bio"
      value={value}
    />
  );
}
