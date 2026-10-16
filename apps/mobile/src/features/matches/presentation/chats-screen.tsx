import { useRouter } from "expo-router";
import { type ReactNode, useCallback } from "react";
import { RefreshControl, ScrollView, type ScrollViewProps, StyleSheet, View } from "react-native";

import type { MatchSummary } from "@cherry/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import {
  Button,
  EmptyState,
  ErrorState,
  Screen,
  TopBar,
  appShellRoutes,
  chatHref,
  useTabBarSpace,
  useTheme
} from "../../../shared/ui";
import { refreshActivitySummary } from "../../activity/application/activity-poller";
import { useActivitySummary } from "../../activity/application/use-activity-summary";
import { useScreenFocus } from "../../activity/presentation/use-screen-focus";
import { useMatchesList } from "../application/use-matches";
import { ChatsList } from "./chats-list";
import { CHATS_PRESENTATION } from "./chats-presentation-config";
import { ChatsSkeleton } from "./chats-skeleton";
import { useChatsNow } from "./use-chats-now";

/** Pestaña Chats: matches nuevos arriba y conversaciones debajo. */
export function ChatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const tabSpace = useTabBarSpace();
  const padding = theme.semantic.layout.screenPadding;
  const list = useMatchesList();
  useActivitySummary();

  const focused = useScreenFocus((first) => {
    if (!first) {
      void list.refreshSilently();
      void refreshActivitySummary();
    }
  });
  const now = useChatsNow(focused);

  const openChat = useCallback((match: MatchSummary) => router.push(chatHref(match.conversationId)), [router]);
  const { hasMore, loadingMore, error, loadMore } = list;
  const loadMoreOnScroll = useCallback<NonNullable<ScrollViewProps["onScroll"]>>(({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    // Solo al desplazarse, no al montar una lista corta de matches nuevos.
    const nearEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - CHATS_PRESENTATION.paginationDistancePx;
    if (nearEnd && hasMore && !loadingMore && !error) void loadMore();
  }, [hasMore, loadingMore, error, loadMore]);

  const refreshControl = (
    <RefreshControl
      colors={[theme.primitives.color.fresaDeep]}
      onRefresh={() => void list.refresh()}
      progressBackgroundColor={theme.primitives.color.white}
      refreshing={list.refreshing}
      tintColor={theme.primitives.color.fresaDeep}
    />
  );

  const loading = (list.status === "loading" || list.status === "idle") && list.matches.length === 0;
  const hasMatches = list.matches.length > 0;
  let body: ReactNode = null;

  if (loading) {
    body = <ChatsSkeleton />;
  } else if (list.status === "error" && !hasMatches) {
    body = (
      <ErrorState
        message={friendlyErrorMessage(list.error, "No hemos podido cargar tus chats ahora mismo.")}
        onRetry={() => void list.reload()}
        testID="chats-error"
      />
    );
  } else if (!hasMatches) {
    body = (
      <EmptyState
        actionIcon="cards"
        actionLabel="Ir a Descubrir"
        description="Cuando a alguien le gustes y a ti también, aparecerá aquí para que habléis. Mientras, date una vuelta por Descubrir."
        mascotColor="cielo"
        mood="happy"
        onAction={() => router.navigate(appShellRoutes.discover)}
        testID="chats-empty"
        title="Aún no tienes matches"
      />
    );
  }

  const centered = loading ? false : !hasMatches;

  return (
    <Screen
      contentStyle={styles.screenContent}
      header={<TopBar size="large" title="Chats" />}
      padded={false}
      testID="chats-screen"
    >
      {hasMatches ? (
        <ChatsList
          bottomSpace={tabSpace}
          conversations={list.conversations}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          newMatches={list.newMatches}
          now={now}
          onLoadMore={list.loadMore}
          onOpen={openChat}
          onScroll={loadMoreOnScroll}
          refreshControl={refreshControl}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            centered ? styles.centered : null,
            { paddingBottom: tabSpace + 32 },
            loading || centered ? { paddingHorizontal: padding } : null
          ]}
          refreshControl={loading ? undefined : refreshControl}
          onScroll={loadMoreOnScroll}
          scrollEventThrottle={CHATS_PRESENTATION.scrollEventThrottleMs}
          showsVerticalScrollIndicator={false}
          testID="chats-list"
        >
          {body}
          {list.hasMore ? (
            <View style={{ paddingHorizontal: padding }}>
              <Button
                disabled={list.loadingMore}
                label={list.loadingMore ? "Cargando chats…" : "Cargar más chats"}
                onPress={() => void list.loadMore()}
                testID="chats-load-more"
              />
            </View>
          ) : null}
        </ScrollView>
      )}
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
    paddingTop: 16,
    gap: 28
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center"
  }
});
