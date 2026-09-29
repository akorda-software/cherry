import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DiscoveryActionType, DiscoveryMode, DiscoveryProfileCard } from "@snack/contracts";
import { createSettingsApi } from "@snack/mobile-shared";

import { friendlyErrorMessage } from "../../../shared/api";
import { Appear, appShellRoutes, PaperBackground, toast, useTabBarSpace } from "../../../shared/ui";
import { refreshBootstrap, useAppBootstrap } from "../../app-bootstrap";
import { useAuthedApi } from "../../auth/presentation";
import {
  discoveryPreferencesStore,
  discoveryQueueStore,
  useDiscoveryPreferences,
  useDiscoveryQueue
} from "../application/discovery-runtime";
import { DiscoverHeader } from "./discover-header";
import { DiscoverError, DiscoverPaused } from "./discover-states";
import { FeedMode } from "./feed/feed-mode";
import { SwipeMode } from "./swipe/swipe-mode";
import { useDiscoveryRuntime } from "./use-discovery-runtime";
import { useOpenProfile } from "./use-open-profile";

/**
 * Descubrir: el corazón de Snack. Modo swipe (pila de polaroids) o feed vertical de posts
 * completos, con la misma cola optimista debajo.
 */
export function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSpace = useTabBarSpace();
  const reducedMotion = useReducedMotion();
  const ownerId = useDiscoveryRuntime();
  const openProfile = useOpenProfile();
  const callSettings = useAuthedApi(createSettingsApi);
  const { state: bootstrapState } = useAppBootstrap();
  const bootstrapPaused = bootstrapState.status === "ready" && bootstrapState.bootstrap.profile.isPaused;

  const status = useDiscoveryQueue((state) => state.status);
  const profiles = useDiscoveryQueue((state) => state.profiles);
  const hasMore = useDiscoveryQueue((state) => state.hasMore);
  const loadingMore = useDiscoveryQueue((state) => state.loadingMore);
  const loadMoreFailed = useDiscoveryQueue((state) => state.loadMoreFailed);
  const error = useDiscoveryQueue((state) => state.error);
  const undoing = useDiscoveryQueue((state) => state.undoing);
  const notice = useDiscoveryQueue((state) => state.notice);
  const lastReturn = useDiscoveryQueue((state) => state.lastReturn);
  const lastRemoval = useDiscoveryQueue((state) => state.lastRemoval);
  const mode = useDiscoveryPreferences((state) => state.mode);
  const modeError = useDiscoveryPreferences((state) => state.modeError);

  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    if (ownerId === null) {
      return;
    }

    if (discoveryPreferencesStore.getState().status === "idle") {
      void discoveryPreferencesStore.getState().load();
    }

    if (!bootstrapPaused && discoveryQueueStore.getState().status === "idle") {
      void discoveryQueueStore.getState().load();
    }
  }, [bootstrapPaused, ownerId]);

  // Avisos amables de la cola (fallo al guardar, nada que deshacer…).
  useEffect(() => {
    if (!notice) {
      return;
    }

    toast.show({
      message: notice.message,
      tone: notice.kind === "nothing_to_undo" ? "info" : "error",
      icon: notice.kind === "nothing_to_undo" ? "undo" : undefined
    });
    discoveryQueueStore.getState().dismissNotice(notice.id);
  }, [notice]);

  useEffect(() => {
    if (modeError) {
      toast.show({ message: modeError, tone: "warning" });
    }
  }, [modeError]);

  // 403 profile_incomplete: falta algo del perfil → al onboarding.
  useEffect(() => {
    if (status === "incomplete") {
      void refreshBootstrap();
      router.replace(appShellRoutes.onboarding);
    }
  }, [router, status]);

  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const resume = useCallback(async () => {
    setResuming(true);
    setResumeError(null);

    try {
      await callSettings((api) => api.unpause());
      await refreshBootstrap();
      toast.show({ message: "¡De vuelta! Ya te pueden ver otra vez.", tone: "success", icon: "sparkles" });
      await discoveryQueueStore.getState().load();
    } catch (err) {
      setResumeError(friendlyErrorMessage(err, "No hemos podido reanudar tu perfil. Inténtalo otra vez."));
    } finally {
      setResuming(false);
    }
  }, [callSettings]);

  const decide = useCallback((card: DiscoveryProfileCard, action: DiscoveryActionType) => {
    // Los lectores de pantalla también «ven» el sello.
    AccessibilityInfo.announceForAccessibility(
      action === "like" ? `Te gusta ${card.displayName}` : `Has pasado de ${card.displayName}`
    );
    void discoveryQueueStore.getState().act(card, action);
  }, []);

  const undo = useCallback(() => {
    void discoveryQueueStore.getState().undo();
  }, []);

  const open = useCallback(
    (card: DiscoveryProfileCard) => openProfile(card, { origin: "discover" }),
    [openProfile]
  );

  const openFilters = useCallback(() => router.push(appShellRoutes.filters), [router]);

  const reload = useCallback(() => {
    void discoveryQueueStore.getState().load();
  }, []);

  const loadMore = useCallback(() => {
    void discoveryQueueStore.getState().loadMore();
  }, []);

  const changeMode = useCallback((next: DiscoveryMode) => {
    void discoveryPreferencesStore.getState().setMode(next);
  }, []);

  const paused = bootstrapPaused || status === "paused";
  const waiting =
    status === "idle" ||
    status === "loading" ||
    status === "incomplete" ||
    (profiles.length === 0 && (loadingMore || hasMore) && !loadMoreFailed);

  let content: React.ReactNode;

  if (paused) {
    content = (
      <View style={[styles.fill, { paddingBottom: bottomSpace }]}>
        <DiscoverPaused error={resumeError} onResume={() => void resume()} resuming={resuming} />
      </View>
    );
  } else if (status === "error") {
    content = (
      <View style={[styles.fill, styles.center, { paddingBottom: bottomSpace }]}>
        <DiscoverError message={error ?? "Inténtalo otra vez en un momento."} onRetry={reload} />
      </View>
    );
  } else if (mode === "feed") {
    content = (
      <FeedMode
        bottomSpace={bottomSpace}
        focused={focused}
        hasMore={hasMore || waiting}
        lastRemoval={lastRemoval}
        loadMoreFailed={loadMoreFailed}
        loadingMore={loadingMore || waiting}
        onDecide={decide}
        onLoadMore={loadMore}
        onOpen={open}
        onRetry={reload}
        onWidenFilters={openFilters}
        profiles={profiles}
        reducedMotion={reducedMotion}
      />
    );
  } else {
    content = (
      <SwipeMode
        bottomSpace={bottomSpace}
        exhausted={status === "ready" && !hasMore && !loadingMore}
        focused={focused}
        lastRemoval={lastRemoval}
        lastReturn={lastReturn}
        loadMoreFailed={loadMoreFailed}
        onDecide={decide}
        onOpen={open}
        onRetry={reload}
        onUndo={undo}
        onWidenFilters={openFilters}
        profiles={profiles}
        reducedMotion={reducedMotion}
        undoing={undoing}
        waiting={waiting}
      />
    );
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]} testID="discover-screen">
      <PaperBackground />
      <DiscoverHeader mode={mode} onModeChange={changeMode} onOpenFilters={openFilters} />
      <Appear key={paused ? "paused" : mode} from="none" style={styles.fill}>
        {content}
      </Appear>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1
  },
  center: {
    justifyContent: "center",
    paddingHorizontal: 24
  }
});
