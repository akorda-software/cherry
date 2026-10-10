import { Linking, StyleSheet, View } from "react-native";

import type { Profile } from "@cherry/contracts";
import type { ProfileApi } from "@cherry/mobile-shared";

import { Skeleton, SkeletonGroup } from "../../../../shared/ui";
import { activePhotos, MAX_PROFILE_PHOTOS, MIN_PROFILE_PHOTOS } from "../../../photos/domain/photo-slots";
import { PhotoGrid } from "../../../photos/presentation/photo-grid";
import { useProfilePhotoManager } from "../../../photos/presentation/use-profile-photo-manager";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { useStepCta } from "../../application/step-cta-store";
import { StepPage } from "../step-page";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft } from "../use-profile-draft";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

function photosHint(count: number, uploading: boolean): string {
  if (uploading) return "Subiendo tus fotos…";
  if (count === 0) return `Añade al menos ${MIN_PROFILE_PHOTOS} fotos`;
  if (count < MIN_PROFILE_PHOTOS) return `Te falta ${MIN_PROFILE_PHOTOS - count} foto`;
  if (count < MAX_PROFILE_PHOTOS) return `${count} de ${MAX_PROFILE_PHOTOS} · puedes añadir más si quieres`;
  return "¡Cuatro de cuatro!";
}

/** Paso 6: de 2 a 4 fotos (se suben al momento, una a una o varias a la vez). */
export function PhotosStep() {
  const { profile, ready, callApi } = useProfileDraft();

  return (
    <StepPage
      step="photos"
      subtitle="Sube de 2 a 4. Las recortamos en vertical para que luzcan en tu polaroid."
      testID="onboarding-step-photos"
      title="Tus mejores fotos"
    >
      <PhotosBody callApi={callApi} key={ready ? "ready" : "loading"} profile={profile} ready={ready} />
    </StepPage>
  );
}

function PhotosBody({ profile, ready, callApi }: { profile: Profile | null; ready: boolean; callApi: CallProfileApi }) {
  const navigation = useOnboardingNavigation();
  const manager = useProfilePhotoManager({
    callApi,
    mode: "onboarding",
    initialPhotos: activePhotos(profile?.photos),
    onPhotosChange: (photos) => useProfileDraftStore.getState().setPhotos(photos)
  });

  useStepCta("photos", {
    enabled: ready && manager.canContinue,
    hint: ready ? photosHint(manager.uploadedCount, manager.uploading) : null,
    onPress: () => navigation.goNext("photos")
  });

  if (!ready) {
    return (
      <SkeletonGroup>
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton height={230} key={index} radius={8} width="47%" />
          ))}
        </View>
      </SkeletonGroup>
    );
  }

  return <PhotoGrid manager={manager} mode="onboarding" onOpenSettings={() => void Linking.openSettings()} testID="onboarding-photos" />;
}

const styles = StyleSheet.create({
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  }
});
