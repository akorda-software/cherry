import type { RelationshipIntent } from "@snack/contracts";

import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveIntents } from "../../application/step-actions";
import { MIN_INTENTS, normalizeIntents } from "../../domain/profile-fields";
import { INTENT_OPTIONS } from "../fields/profile-options";
import { useProfileDraft } from "../use-profile-draft";
import { MultiChoiceStep } from "./multi-choice-step";

/** Paso 5: qué buscas (una o varias). «A ver qué pasa» encaja con todas las intenciones. */
export function IntentStep() {
  const { profile, ready, callApi } = useProfileDraft();

  return (
    <MultiChoiceStep<RelationshipIntent>
      min={MIN_INTENTS}
      options={INTENT_OPTIONS}
      ready={ready}
      save={async (intents) => {
        const saved = await callApi((api) => saveIntents(api, intents));
        useProfileDraftStore.getState().setProfile(saved);
      }}
      saved={profile ? normalizeIntents(profile.lookingFor) : undefined}
      step="intent"
      subtitle="Puedes elegir varias. Solo verás a gente que busca algo compatible contigo."
      testID="onboarding-intent"
      title="¿Qué buscas?"
    />
  );
}
