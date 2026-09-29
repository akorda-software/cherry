import { useRef } from "react";
import { Linking } from "react-native";

import type { Profile } from "@snack/contracts";
import type { ProfileApi } from "@snack/mobile-shared";

import { Text } from "../../../../shared/ui";
import { activePhotos } from "../../../photos/domain/photo-slots";
import { PhotoGrid } from "../../../photos/presentation/photo-grid";
import { useProfilePhotoManager } from "../../../photos/presentation/use-profile-photo-manager";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { useProfileDraft } from "../use-profile-draft";
import { EditScaffold, toastSaved, useLeaveEdit } from "./edit-scaffold";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

/** Editar fotos: la misma rejilla del onboarding; cada cambio se guarda al momento. */
export function EditPhotosScreen() {
  const { profile, ready, failed, retry, callApi } = useProfileDraft();

  if (!ready || !profile) {
    return (
      <EditScaffold
        canSave={false}
        dirty={false}
        failed={failed}
        loading
        onRetry={retry}
        onSave={() => undefined}
        saving={false}
        testID="edit-photos-screen"
        title="Tus fotos"
      />
    );
  }

  return <EditPhotosBody callApi={callApi} profile={profile} />;
}

function EditPhotosBody({ profile, callApi }: { profile: Profile; callApi: CallProfileApi }) {
  const leave = useLeaveEdit();
  const changed = useRef(false);
  const manager = useProfilePhotoManager({
    callApi,
    mode: "edit",
    initialPhotos: activePhotos(profile.photos),
    onPhotosChange: (photos) => {
      changed.current = true;
      useProfileDraftStore.getState().setPhotos(photos);
    }
  });

  return (
    <EditScaffold
      canSave
      dirty={false}
      failed={false}
      loading={false}
      onRetry={() => undefined}
      onSave={() => {
        if (changed.current) toastSaved();
        leave();
      }}
      saveEnabled={!manager.uploading}
      saveLabel={manager.uploading ? "Subiendo..." : "Listo"}
      saving={false}
      testID="edit-photos-screen"
      title="Tus fotos"
      tone="melocoton"
    >
      <Text color="muted">De 2 a 4 fotos. Los cambios se guardan al momento; la primera es la que se ve antes.</Text>
      <PhotoGrid manager={manager} mode="edit" onOpenSettings={() => void Linking.openSettings()} testID="edit-photos" />
    </EditScaffold>
  );
}
