import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";

import { friendlyErrorMessage } from "../../../shared/api";
import {
  EmptyState,
  ErrorState,
  LoadingDots,
  Screen,
  TopBar,
  appShellRoutes,
  profileHref,
  toast,
  useTabBarSpace,
  useTheme
} from "../../../shared/ui";
import { useActivitySummary } from "../../activity/application/use-activity-summary";
import { useScreenFocus } from "../../activity/presentation/use-screen-focus";
import { useReceivedLikes } from "../application/use-received-likes";
import { LikePolaroid } from "./like-polaroid";
import { LikesSkeleton } from "./likes-skeleton";
import { UndoNote } from "./undo-note";

const GAP = 14;
const MIN_CARD = 150;
const MAX_CARD = 220;
const LOAD_MORE_THRESHOLD = 600;

export const LIKES_INTRO =
  "Aquí no escondemos nada: estas personas ya te han dado like. Si te gusta alguien, es match al instante.";

function useGrid(horizontalPadding: number, maxWidth: number) {
  const { width } = useWindowDimensions();
  const available = Math.min(width, maxWidth) - horizontalPadding * 2;
  const columns = Math.max(2, Math.floor((available + GAP) / (MIN_CARD + GAP)));
  const cardWidth = Math.min(MAX_CARD, Math.floor((available - GAP * (columns - 1)) / columns));
  return { columns, cardWidth };
}

/** Pestaña Likes: quién te ha dado like, gratis y a la vista. */
export function LikesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const tabSpace = useTabBarSpace();
  const padding = theme.semantic.layout.screenPadding;
  const { columns, cardWidth } = useGrid(padding, theme.semantic.layout.contentMaxWidth);
  const likes = useReceivedLikes();
  useActivitySummary();

  const focused = useScreenFocus((first) => {
    if (!first) {
      void likes.refreshSilently();
    }
  });

  // Al salir de la pestaña, el «deshacer» ya no tiene sentido.
  const { dismissUndo, dismissNotice } = likes;
  useEffect(() => {
    if (!focused) {
      dismissUndo();
    }
  }, [dismissUndo, focused]);

  useEffect(() => {
    if (likes.notice) {
      toast.show({ message: likes.notice.message, tone: likes.notice.tone === "error" ? "error" : "info" });
      dismissNotice();
    }
  }, [dismissNotice, likes.notice]);

  // Cascada solo para el primer lote; lo que vuelve (deshacer, fallo) se pega con un pop.
  const firstBatch = useRef<Map<string, number> | null>(null);
  const seen = useRef(new Set<string>());
  if (firstBatch.current === null && likes.status === "ready") {
    firstBatch.current = new Map(likes.likes.map((like, index) => [like.profile.id, index]));
  }

  const cards = useMemo(
    () =>
      likes.likes.map((like, index) => {
        const id = like.profile.id;
        const batchIndex = firstBatch.current?.get(id);
        const restored = seen.current.has(id) && batchIndex === undefined;
        return {
          like,
          index,
          enterDelay: batchIndex !== undefined ? Math.min(batchIndex, 7) * 55 : restored ? null : 0,
          stampDelay: batchIndex !== undefined ? 260 + Math.min(batchIndex, 7) * 110 : 120
        };
      }),
    [likes.likes]
  );

  useEffect(() => {
    likes.likes.forEach((like) => seen.current.add(like.profile.id));
    // Tras montar, lo que reaparezca del primer lote ya no hace cascada.
    if (firstBatch.current && firstBatch.current.size > 0) {
      const timer = setTimeout(() => firstBatch.current?.clear(), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [likes.likes]);

  const openProfile = useCallback((profileId: string) => router.push(profileHref(profileId)), [router]);
  const { like: likeBack, pass, loadMore } = likes;
  const onLike = useCallback((profileId: string) => void likeBack(profileId), [likeBack]);
  const onPass = useCallback((profileId: string) => void pass(profileId), [pass]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - LOAD_MORE_THRESHOLD) {
      void loadMore();
    }
  }

  const refreshControl = (
    <RefreshControl
      colors={[theme.primitives.color.fresaDeep]}
      onRefresh={() => void likes.refresh()}
      progressBackgroundColor={theme.primitives.color.white}
      refreshing={likes.refreshing}
      tintColor={theme.primitives.color.fresaDeep}
    />
  );

  const showIntro = likes.likes.length > 0 || likes.status === "loading" || likes.status === "idle";
  const contentPadding = { paddingHorizontal: padding, paddingBottom: tabSpace + 32 };

  let body: ReactNode;

  if ((likes.status === "loading" || likes.status === "idle") && likes.likes.length === 0) {
    body = (
      <ScrollView contentContainerStyle={[styles.content, contentPadding]} scrollEnabled={false}>
        <LikesSkeleton cardWidth={cardWidth} columns={columns} gap={GAP} />
      </ScrollView>
    );
  } else if (likes.status === "error" && likes.likes.length === 0) {
    body = (
      <ScrollView contentContainerStyle={[styles.centered, contentPadding]} refreshControl={refreshControl}>
        <ErrorState
          message={friendlyErrorMessage(likes.error, "No hemos podido cargar tus likes ahora mismo.")}
          onRetry={() => void likes.reload()}
          testID="likes-error"
        />
      </ScrollView>
    );
  } else if (likes.likes.length === 0) {
    body = (
      <ScrollView contentContainerStyle={[styles.centered, contentPadding]} refreshControl={refreshControl}>
        <EmptyState
          actionIcon="pencil"
          actionLabel="Retocar mi perfil"
          description="Mientras, un perfil completo con buenas fotos y etiquetas ayuda un montón."
          mascotColor="limonada"
          mood="thinking"
          onAction={() => router.push(appShellRoutes.editTags)}
          testID="likes-empty"
          title="Todavía no hay likes, pero llegarán"
        />
      </ScrollView>
    );
  } else {
    body = (
      <ScrollView
        contentContainerStyle={[styles.content, contentPadding]}
        onScroll={handleScroll}
        refreshControl={refreshControl}
        scrollEventThrottle={64}
        showsVerticalScrollIndicator={false}
        testID="likes-list"
      >
        <View style={[styles.grid, { columnGap: GAP, rowGap: GAP + 10 }]}>
          {cards.map(({ like, index, enterDelay, stampDelay }) => (
            <LikePolaroid
              busy={likes.pending[like.profile.id] !== undefined}
              enterDelay={enterDelay}
              index={index}
              key={like.profile.id}
              like={like}
              onLike={onLike}
              onOpen={openProfile}
              onPass={onPass}
              stampDelay={stampDelay}
              width={cardWidth}
            />
          ))}
        </View>
        {likes.loadingMore ? (
          <View style={styles.more}>
            <LoadingDots accessibilityLabel="Cargando más likes" />
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <Screen
      contentStyle={styles.screenContent}
      header={<TopBar size="large" subtitle={showIntro ? LIKES_INTRO : undefined} title="Les gustas" />}
      padded={false}
      testID="likes-screen"
    >
      {body}
      <UndoNote
        bottomOffset={tabSpace + 12}
        name={likes.lastPass?.like.profile.displayName ?? ""}
        onDismiss={dismissUndo}
        onUndo={() => void likes.undoPass()}
        passKey={likes.lastPass ? `${likes.lastPass.like.profile.id}-${likes.lastPass.at}` : null}
        undoing={likes.undoing}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0
  },
  content: {
    paddingTop: 22
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  more: {
    alignItems: "center",
    paddingTop: 20
  }
});
