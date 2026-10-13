import { useCallback, useMemo } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import type { Profile } from "@cherry/contracts";
import { createProfileApi } from "@cherry/mobile-shared";

import {
  appShellRoutes,
  Button,
  Deco,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  Skeleton,
  SkeletonGroup,
  Stack,
  Surface,
  Text,
  TopBar,
  useTheme
} from "../../../shared/ui";
import { useAuthedApi } from "../../auth/presentation";
import { useVerificationPending, verificationRoutes } from "../../verification";
import { PAUSED_MESSAGE, type ProfilePause, useProfilePause } from "../../settings/presentation/use-profile-pause";
import { useMyProfile } from "../application/use-my-profile";
import { meRoutes, type MeRoute } from "../domain/me-routes";
import { assessProfileStrength } from "../domain/profile-strength";
import {
  describeBasics,
  describeBio,
  describeFilters,
  describePhotoCount,
  describeTagCount
} from "../domain/profile-summaries";
import { ProfileStrengthNote } from "./profile-strength-note";
import { SelfPreviewCard } from "./self-preview-card";

const MAX_PREVIEW_WIDTH = 312;

/**
 * Pestaña Yo: tu perfil tal como te ven, cómo va, accesos de edición y la pausa.
 * Ajustes vive en el engranaje de la cabecera.
 */
export function MeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const callApi = useAuthedApi(createProfileApi);
  const fetchProfile = useCallback(() => callApi((api) => api.getProfile()), [callApi]);
  const me = useMyProfile(fetchProfile);
  const pause = useProfilePause();
  const pendingVerification = useVerificationPending();
  const { reload } = me;

  // Al volver de editar fotos, etiquetas o bio, refresca sin quitar lo que ya se ve.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const go = useCallback((href: MeRoute) => router.push(href), [router]);
  const previewWidth = Math.min(windowWidth - 2 * theme.semantic.layout.screenPadding - 8, MAX_PREVIEW_WIDTH);

  return (
    <Screen
      header={
        <TopBar
          right={
            <IconButton
              accessibilityLabel="Ajustes"
              icon="gear"
              onPress={() => router.push(meRoutes.settings)}
              size="sm"
              testID="me-settings"
            />
          }
          size="large"
          title="Yo"
        />
      }
      scroll
      testID="me-screen"
    >
      {pendingVerification ? (
        <Surface color="limonada" padding="md" radius="lg" soft testID="me-verification-pending">
          <Stack gap="sm">
            <Text variant="bodyStrong">Tu perfil aún no está activo</Text>
            <Text color="muted" variant="callout">
              Nadie te ve hasta que compruebes tu edad. Mientras, puedes dejarlo a tu gusto.
            </Text>
            <Button
              icon="shield-check"
              onPress={() => router.push(verificationRoutes.intro)}
              style={styles.pendingButton}
              testID="me-verify"
            >
              Comprobar mi edad
            </Button>
          </Stack>
        </Surface>
      ) : null}

      {me.status === "loading" ? <MeSkeleton previewWidth={previewWidth} /> : null}

      {me.status === "error" ? (
        <ErrorState
          message={me.error ?? "No hemos podido cargar tu perfil."}
          onRetry={() => void me.reload()}
          testID="me-error"
        />
      ) : null}

      {me.status === "missing" ? (
        <EmptyState
          actionIcon="sparkles"
          actionLabel="Crear mi perfil"
          description="En un par de minutos lo tienes listo y empiezas a conocer gente."
          onAction={() => router.replace(appShellRoutes.onboarding)}
          testID="me-missing"
          title="Aún no tienes perfil"
        />
      ) : null}

      {me.status === "ready" && me.profile ? (
        <ProfileSections go={go} pause={pause} previewWidth={previewWidth} profile={me.profile} />
      ) : null}
    </Screen>
  );
}

interface ProfileSectionsProps {
  profile: Profile;
  pause: ProfilePause;
  previewWidth: number;
  go(href: MeRoute): void;
}

function ProfileSections({ profile, pause, previewWidth, go }: ProfileSectionsProps) {
  const strength = useMemo(() => assessProfileStrength(profile), [profile]);
  const filters = describeFilters(profile.discoveryPreferences);

  return (
    <>
      <View style={styles.preview}>
        <View style={styles.previewTitle}>
          <Text role="heading" style={styles.handTitle} variant="hand">
            Así te ven
          </Text>
          <Deco color="limonada" kind="sparkle" rotation={12} size={18} />
        </View>
        <SelfPreviewCard paused={pause.isPaused} profile={profile} testID="me-preview" width={previewWidth} />
      </View>

      <ProfileStrengthNote onNavigate={go} strength={strength} />

      <ListSection title="Tu perfil">
        <ListRow
          icon="camera"
          iconColor="fresa"
          label="Fotos"
          onPress={() => go(meRoutes.editPhotos)}
          testID="me-edit-photos"
          value={describePhotoCount(profile.photos.length)}
        />
        <ListRow
          icon="tag"
          iconColor="limonada"
          label="Mis etiquetas"
          onPress={() => go(meRoutes.editTags)}
          testID="me-edit-tags"
          value={describeTagCount(profile.tags.length)}
        />
        <ListRow
          description={describeBio(profile.bio)}
          icon="pencil"
          iconColor="menta"
          label="Sobre mí"
          onPress={() => go(meRoutes.editBio)}
          testID="me-edit-bio"
        />
        <ListRow
          description={describeBasics(profile)}
          icon="user"
          iconColor="cielo"
          label="Lo básico"
          onPress={() => go(meRoutes.editBasics)}
          testID="me-edit-basics"
        />
        <ListRow
          description={filters ?? "Edad, distancia y a quién quieres conocer"}
          icon="sliders"
          iconColor="lavanda"
          label="Filtros de búsqueda"
          onPress={() => go(meRoutes.filters)}
          testID="me-filters"
        />
      </ListSection>

      <ListSection footnote="Tomarte un respiro está bien." title="Visibilidad">
        <ListRow
          description={
            // El estado vive en la propia fila (sin aviso arriba: al aparecer, empujaba la
            // pantalla y el interruptor se escapaba del dedo).
            pause.isPaused ? PAUSED_MESSAGE : "Dejas de salir en Descubrir y en Likes. Tus chats siguen aquí."
          }
          disabled={pause.pending}
          icon="moon"
          iconColor="lavanda"
          label="Pausar mi perfil"
          onSwitchChange={(next) => void pause.toggle(next)}
          switchValue={pause.isPaused}
          testID="me-pause"
        />
      </ListSection>
    </>
  );
}

function MeSkeleton({ previewWidth }: { previewWidth: number }) {
  return (
    <SkeletonGroup>
      <View accessibilityLabel="Cargando tu perfil" style={styles.skeleton} testID="me-loading">
        <Skeleton height={26} width={130} />
        <Skeleton height={Math.round(previewWidth * 1.55)} radius={22} style={styles.skeletonPreview} width={previewWidth} />
        <Skeleton color="limonada" height={110} radius={16} />
        <Skeleton height={320} radius={22} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  pendingButton: {
    alignSelf: "flex-start"
  },
  preview: {
    gap: 12
  },
  previewTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4
  },
  handTitle: {
    transform: [{ rotate: "-2deg" }]
  },
  skeleton: {
    gap: 18
  },
  skeletonPreview: {
    alignSelf: "center"
  }
});
