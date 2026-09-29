import { useEffect, useState } from "react";

import { useLogoutAction } from "../../../auth/presentation";
import { Button, Stack, TextField } from "../../../../shared/ui";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveDisplayName } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import { DISPLAY_NAME_MAX, normalizeDisplayName, suggestedFirstName, validateDisplayName } from "../../domain/profile-fields";
import { StepPage } from "../step-page";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useAccountIdentity, useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";

/** Paso 1: «¿Cómo te llamas?». Crea el borrador del perfil (`PUT /api/me/profile`). */
export function NameStep() {
  const { profile, ready, callApi } = useProfileDraft();
  const { accountName } = useAccountIdentity();
  const navigation = useOnboardingNavigation();
  const { busy, error, setError, run } = useStepSave();
  const [name, setName] = useState<string | null>(null);
  const logout = useLogoutAction();

  useEffect(() => {
    if (ready && name === null) {
      setName(profile?.displayName ?? suggestedFirstName(accountName));
    }
  }, [accountName, name, profile?.displayName, ready]);

  const value = name ?? "";
  const valid = validateDisplayName(value).ok;

  const submit = () => {
    if (!valid) {
      setError("Dinos cómo te llamas.");
      return;
    }

    void run(async () => {
      if (!profile || normalizeDisplayName(value) !== profile.displayName) {
        const saved = await callApi((api) => saveDisplayName(api, value));
        useProfileDraftStore.getState().setProfile(saved);
      }

      navigation.goNext("name");
    });
  };

  useStepCta("name", { enabled: valid && ready, busy, onPress: submit });

  return (
    <StepPage step="name" subtitle="Así te verán los demás. Puedes cambiarlo cuando quieras." testID="onboarding-step-name" title="¿Cómo te llamas?">
      <Stack gap="xl">
        <TextField
          accessibilityLabel="Tu nombre"
          autoCapitalize="words"
          autoComplete="given-name"
          autoCorrect={false}
          autoFocus
          color="fresa"
          counter={false}
          editable={ready}
          enterKeyHint="next"
          error={error}
          maxLength={DISPLAY_NAME_MAX}
          onChangeText={(text) => {
            setName(text);
            if (error) setError(null);
          }}
          onSubmitEditing={submit}
          placeholder="Tu nombre"
          returnKeyType="next"
          size="xl"
          submitBehavior="submit"
          testID="onboarding-name-input"
          textContentType="givenName"
          value={value}
        />
        <Button onPress={() => void logout()} size="sm" style={{ alignSelf: "flex-start" }} testID="onboarding-logout" variant="ghost">
          ¿No es tu cuenta? Salir
        </Button>
      </Stack>
    </StepPage>
  );
}
