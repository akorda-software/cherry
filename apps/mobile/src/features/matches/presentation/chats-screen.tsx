import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import type { MatchSummary } from "@snack/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import {
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  Mascot,
  Screen,
  StickyNote,
  Surface,
  Text,
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
import { ChatsSkeleton } from "./chats-skeleton";
import { ConversationRow } from "./conversation-row";
import { NewMatchAvatar } from "./new-match-avatar";

/** Refresca las horas relativas («hace 5 min») sin esperar a la red. */
function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/** Pestaña Chats: matches nuevos arriba y conversaciones debajo. */
export function ChatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const tabSpace = useTabBarSpace();
  const padding = theme.semantic.layout.screenPadding;
  const list = useMatchesList();
  const now = useNow();
  useActivitySummary();

  useScreenFocus((first) => {
    if (!first) {
      void list.refreshSilently();
      void refreshActivitySummary();
    }
  });

  const openChat = useCallback((match: MatchSummary) => router.push(chatHref(match.conversationId)), [router]);

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
  let body: ReactNode;

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
  } else {
    body = (
      <>
        {list.newMatches.length > 0 ? (
          <View style={styles.section} testID="chats-new-matches">
            <View style={[styles.sectionTitle, { paddingHorizontal: padding }]}>
              <Text role="heading" variant="title3">
                Nuevos matches
              </Text>
              <Badge color="limonada" count={list.newMatches.length} />
            </View>
            <ScrollView
              contentContainerStyle={[styles.newRow, { paddingHorizontal: padding }]}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {list.newMatches.map((match, index) => (
                <NewMatchAvatar index={index} key={match.id} match={match} now={now} onOpen={openChat} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {list.conversations.length > 0 ? (
          <View style={[styles.section, { paddingHorizontal: padding }]} testID="chats-conversations">
            <Text role="heading" variant="title3">
              Mensajes
            </Text>
            <Surface clip padding={0} radius="lg">
              {list.conversations.map((match, index) => (
                <View key={match.id}>
                  {index > 0 ? <Divider style={styles.divider} /> : null}
                  <ConversationRow match={match} now={now} onOpen={openChat} />
                </View>
              ))}
            </Surface>
          </View>
        ) : (
          <View style={[styles.section, { paddingHorizontal: padding }]}>
            <StickyNote
              color="limonada"
              tape={{ color: "fresa", pattern: "hearts" }}
              testID="chats-icebreak-note"
              tilt={-1.5}
            >
              <View style={styles.note}>
                <Mascot animated={false} mood="wink" size={64} />
                <View style={styles.noteTexts}>
                  <Text variant="title3">¡Rompe el hielo!</Text>
                  <Text variant="hand">
                    Toca a alguien de arriba y salúdale. Una pregunta sobre algo que tengáis en común funciona de
                    maravilla.
                  </Text>
                </View>
              </View>
            </StickyNote>
          </View>
        )}
      </>
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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          centered ? styles.centered : null,
          { paddingBottom: tabSpace + 32 },
          loading || centered ? { paddingHorizontal: padding } : null
        ]}
        refreshControl={loading ? undefined : refreshControl}
        onScroll={({ nativeEvent }) => {
          if (nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 240) {
            if (list.hasMore && !list.loadingMore && !list.error) void list.loadMore();
          }
        }}
        scrollEventThrottle={200}
        showsVerticalScrollIndicator={false}
        testID="chats-list"
      >
        {body}
        {list.hasMore ? (
          <View style={{ paddingHorizontal: padding }}>
            <Button
              label={list.loadingMore ? "Cargando chats…" : "Cargar más chats"}
              disabled={list.loadingMore}
              onPress={() => void list.loadMore()}
              testID="chats-load-more"
            />
          </View>
        ) : null}
      </ScrollView>
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
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  newRow: {
    gap: 8,
    paddingVertical: 6
  },
  divider: {
    marginHorizontal: 16
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  noteTexts: {
    flex: 1,
    gap: 4
  }
});
