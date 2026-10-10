import type { Gender } from "@cherry/contracts";

import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveGender } from "../../application/step-actions";
import { isGender } from "../../domain/profile-fields";
import { GENDER_OPTIONS } from "../fields/profile-options";
import { useProfileDraft } from "../use-profile-draft";
import { SingleChoiceStep } from "./single-choice-step";

/** Paso 3: género (tarjetas grandes, un toque). */
export function GenderStep() {
  const { profile, ready, callApi } = useProfileDraft();

  return (
    <SingleChoiceStep<Gender>
      options={GENDER_OPTIONS}
      ready={ready}
      save={async (gender) => {
        const saved = await callApi((api) => saveGender(api, gender));
        useProfileDraftStore.getState().setProfile(saved);
      }}
      saved={isGender(profile?.gender) ? profile.gender : null}
      step="gender"
      subtitle="Así te encuentra quien busca a alguien como tú."
      testID="onboarding-gender"
      title="¿Cómo te identificas?"
    />
  );
}
