import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DiscoveryActionType } from "@snack/contracts";
import { createDiscoveryApi, createPublicProfileApi } from "@snack/mobile-shared";

import {
  appShellRoutes,
  Button,
  chatHref,
  EmptyState,
  ErrorState,
  FormMessage,
  haptics,
  IconButton,
  PaperBackground,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Stack,
  Stamp,
  Text,
  TopBar,
  useTheme
} from "../../../../shared/ui";
import { useAuthedApi } from "../../../auth/presentation";
import { useMatchCelebrationStore } from "../../../match/match-celebration-store";
import { NameSticker, PhotoCarousel, ProfileSummary } from "../../../profile-card";
import { SafetySheet } from "../../../safety";
import { discoveryQueueStore } from "../../application/discovery-runtime";
import { type FullProfileDeps, useFullProfile } from "../../application/use-full-profile";
import { useDiscoveryRuntime } from "../use-discovery-runtime";

const FRAME = 10;
const MAX_WIDTH = 520;

/** `#RRGGBB` del tema + opacidad → `rgba(…)` (para el fundido del papel). */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Perfil completo de otra persona. Se pinta al instante con la card que ya tenías y se
 * refresca con `GET /api/profiles/:id`. ✕ / ♥ flotantes (o «Enviar mensaje» si hay match)
 * y ⋯ para reportar o bloquear.
 */
export function FullProfileScreen({ profileId }: { profileId: string }) {
  useDiscoveryRuntime();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const callPublic = useAuthedApi(createPublicProfileApi);
  const callDiscovery = useAuthedApi(createDiscoveryApi);

  const deps = useMemo<FullProfileDeps>(
    () => ({
      getProfile: (id) => callPublic((api) => api.getProfile(id)),
      recordAction: (request) => callDiscovery((api) => api.recordAction(request)),
      queue: discoveryQueueStore,
      showMatch: (match) => useMatchCelebrationStore.getState().show(match)
    }),
    [callDiscovery, callPublic]
  );

  const profile = useFullProfile(profileId, deps);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [stamp, setStamp] = useState<DiscoveryActionType | null>(null);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (leaving.current) {
        clearTimeout(leaving.current);
      }
    },
    []
  );

  const goBack = useCallback(() => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
    } else {
      router.replace(appShellRoutes.discover);
    }
  }, [router]);

  const decide = useCallback(
    async (action: DiscoveryActionType) => {
      if (profile.acting || stamp) {
        return;
      }

      if (action === "like") {
        haptics.medium();
      } else {
        haptics.light();
      }

      setStamp(action);
      const done = await profile.act(action);

      if (!done) {
        setStamp(null);
        haptics.error();
        return;
      }

      // El sello se lee un instante y volvemos a la pila (que despide la card al verla).
      leaving.current = setTimeout(goBack, reducedMotion ? 180 : 460);
    },
    [goBack, profile, reducedMotion, stamp]
  );

  const frameWidth = Math.min(windowWidth - 40, MAX_WIDTH);
  const photoWidth = frameWidth - FRAME * 2;
  const photoHeight = Math.round(photoWidth * 1.22);
  const person = profile.person;
  const name = person?.displayName ?? "esta persona";
  const { conversationId, youLiked, likedYou } = profile.relationship;
  const actionBarHeight = 112;

  const header = (
    <TopBar
      left={
        <IconButton
          accessibilityLabel="Volver"
          icon="chevron-down"
          onPress={goBack}
          size="sm"
          testID="profile-close"
        />
      }
      right={
        person && profile.status !== "not_found" ? (
          <IconButton
            accessibilityHint="Reportar o bloquear"
            accessibilityLabel={`Más opciones sobre ${name}`}
            icon="more-horizontal"
            onPress={() => setSafetyOpen(true)}
            size="sm"
            testID="profile-more"
          />
        ) : undefined
      }
      title={person ? undefined : "Perfil"}
    />
  );

  let body: React.ReactNode;

  if (profile.status === "not_found") {
    body = (
      <View style={styles.center}>
        <EmptyState
          actionIcon="arrow-left"
          actionLabel="Volver"
          description="Puede que haya pausado su perfil o que ya no esté en Snack. No es nada que hayas hecho tú."
          mood="sad"
          onAction={goBack}
          testID="profile-not-found"
          title="Este perfil ya no está disponible"
        />
      </View>
    );
  } else if (profile.status === "error" || (!person && profile.status !== "loading")) {
    body = (
      <View style={styles.center}>
        <ErrorState message={profile.error ?? "Inténtalo otra vez en un momento."} onRetry={profile.reload} testID="profile-error" />
      </View>
    );
  } else if (!person) {
    body = <ProfileSkeleton frameWidth={frameWidth} photoHeight={photoHeight} />;
  } else {
    body = (
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: actionBarHeight + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        testID="profile-scroll"
      >
        <View
          style={[
            styles.frame,
            {
              width: frameWidth,
              padding: FRAME,
              backgroundColor: theme.primitives.color.white,
              borderColor: theme.primitives.color.ink,
              borderWidth: theme.primitives.border.bold,
              borderRadius: theme.primitives.radius.md
            },
            theme.primitives.elevation.lg
          ]}
        >
          <PhotoCarousel
            height={photoHeight}
            name={person.displayName}
            photos={person.photos}
            radius={theme.primitives.radius.sm}
            tape
            testID="profile-photos"
            width={photoWidth}
          />
          <View style={[styles.name, { top: FRAME + photoHeight - 30 }]}>
            <NameSticker age={person.age} name={person.displayName} size="lg" />
          </View>
          <View style={styles.nameSpace} />
          {stamp ? (
            <View pointerEvents="none" style={[styles.stamp, { top: FRAME + photoHeight * 0.34 }]}>
              <Stamp
                label={stamp === "like" ? "¡Me gusta!" : "Paso"}
                rotation={stamp === "like" ? -12 : 10}
                size="lg"
                slam
                tone={stamp === "like" ? "fresa" : "lavanda"}
              />
            </View>
          ) : null}
        </View>

        <ProfileSummary profile={person} style={styles.summary} testID="profile-summary" variant="full" />

        {profile.error ? (
          <FormMessage style={styles.summary} tone="info">
            No hemos podido actualizar este perfil; te enseñamos lo que ya teníamos.
          </FormMessage>
        ) : null}
      </ScrollView>
    );
  }

  const showActions = person !== null && profile.status === "ready";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="profile-screen">
      <PaperBackground />
      {header}
      {body}

      {showActions ? (
        <View
          pointerEvents="box-none"
          style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        >
          {/* El papel se funde bajo los botones: nunca tapan el texto a medias. */}
          <LinearGradient
            colors={[withAlpha(theme.primitives.color.paper, 0), withAlpha(theme.primitives.color.paper, 0.94), theme.primitives.color.paper]}
            locations={[0, 0.45, 1]}
            pointerEvents="none"
            style={styles.fade}
          />
          {conversationId ? (
            <Button
              icon="chat"
              onPress={() =>
                profile.origin === "chat" ? goBack() : router.push(chatHref(conversationId))
              }
              size="lg"
              testID="profile-message"
            >
              Enviar mensaje
            </Button>
          ) : youLiked ? (
            <View
              style={[
                styles.sent,
                {
                  backgroundColor: theme.primitives.pastel.fresa.soft,
                  borderColor: theme.primitives.color.ink,
                  borderWidth: theme.primitives.border.regular,
                  borderRadius: theme.primitives.radius.pill
                },
                theme.primitives.elevation.sm
              ]}
              testID="profile-like-sent"
            >
              <Text variant="label">{`Le has dado like. Si te lo devuelve, haréis match.`}</Text>
            </View>
          ) : (
            <Stack align="center" gap="xs">
              {profile.actionError ? (
                <FormMessage tone="error">{profile.actionError}</FormMessage>
              ) : likedYou ? (
                <Text color="accent" variant="caption">
                  {`A ${name} le gustas: si le das like, es match`}
                </Text>
              ) : null}
              <View style={styles.buttons}>
                <IconButton
                  accessibilityLabel={`Paso de ${name}`}
                  color="lavanda"
                  disabled={profile.acting !== null || stamp !== null}
                  icon="x"
                  onPress={() => void decide("dislike")}
                  size="lg"
                  testID="profile-pass"
                />
                <IconButton
                  accessibilityLabel={`Me gusta ${name}`}
                  color="fresa"
                  disabled={profile.acting !== null || stamp !== null}
                  icon="heart"
                  iconFill={theme.primitives.color.white}
                  onPress={() => void decide("like")}
                  size="xl"
                  testID="profile-like"
                />
              </View>
            </Stack>
          )}
        </View>
      ) : null}

      {person ? (
        <SafetySheet
          displayName={name}
          onBlocked={() => {
            profile.afterSafetyAction("blocked");
            goBack();
          }}
          onClose={() => setSafetyOpen(false)}
          onReported={() => profile.afterSafetyAction("reported")}
          profileId={profileId}
          visible={safetyOpen}
        />
      ) : null}
    </View>
  );
}

function ProfileSkeleton({ frameWidth, photoHeight }: { frameWidth: number; photoHeight: number }) {
  const theme = useTheme();

  return (
    <View accessibilityLabel="Cargando perfil" accessibilityRole="progressbar" style={styles.scroll} testID="profile-loading">
      <SkeletonGroup>
        <View
          style={[
            styles.frame,
            {
              width: frameWidth,
              padding: FRAME,
              backgroundColor: theme.primitives.color.white,
              borderColor: theme.primitives.color.ink,
              borderWidth: theme.primitives.border.bold,
              borderRadius: theme.primitives.radius.md
            },
            theme.primitives.elevation.lg
          ]}
        >
          <Skeleton color="fresa" height={photoHeight} radius={theme.primitives.radius.sm} />
          <View style={styles.skeletonInfo}>
            <Skeleton color="limonada" height={40} radius={20} width="60%" />
          </View>
        </View>
        <View style={[styles.summary, styles.skeletonInfo]}>
          <SkeletonText color="lavanda" lines={3} />
        </View>
      </SkeletonGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 20
  },
  frame: {
    overflow: "visible"
  },
  name: {
    position: "absolute",
    left: FRAME + 8,
    right: FRAME + 8
  },
  nameSpace: {
    height: 30
  },
  stamp: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center"
  },
  summary: {
    alignSelf: "stretch",
    maxWidth: MAX_WIDTH,
    width: "100%",
    marginTop: 26
  },
  skeletonInfo: {
    paddingTop: 16,
    gap: 12
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 36
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28
  },
  sent: {
    paddingHorizontal: 18,
    paddingVertical: 12
  }
});
