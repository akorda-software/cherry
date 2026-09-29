import type { RelationshipIntent } from "@snack/contracts";

import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveIntent } from "../../application/step-actions";
import { isRelationshipIntent } from "../../domain/profile-fields";
import { INTENT_OPTIONS } from "../fields/profile-options";
import { useProfileDraft } from "../use-profile-draft";
import { SingleChoiceStep } from "./single-choice-step";

/** Paso 5: qué buscas. «A ver qué pasa» encaja con todas las intenciones. */
export function IntentStep() {
  const { profile, ready, callApi } = useProfileDraft();

  return (
    <SingleChoiceStep<RelationshipIntent>
      options={INTENT_OPTIONS}
      ready={ready}
      save={async (intent) => {
        const saved = await callApi((api) => saveIntent(api, intent));
        useProfileDraftStore.getState().setProfile(saved);
      }}
      saved={isRelationshipIntent(profile?.whatIAmLookingFor) ? profile.whatIAmLookingFor : null}
      step="intent"
      subtitle="Solo verás a gente que busca algo compatible contigo."
      testID="onboarding-intent"
      title="¿Qué buscas?"
    />
  );
}
