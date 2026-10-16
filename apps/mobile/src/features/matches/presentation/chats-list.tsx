import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { type ReactElement, useCallback, useMemo } from "react";
import { type RefreshControlProps, type ScrollViewProps, StyleSheet, View } from "react-native";

import type { MatchSummary } from "@cherry/contracts";

import { Button, Mascot, StickyNote, Text, useTheme } from "../../../shared/ui";
import { buildChatsListItems, chatsItemKey, chatsItemType, type ChatsListItem } from "./chats-list-model";
import { CHATS_PRESENTATION } from "./chats-presentation-config";
import { GroupedConversationRow } from "./grouped-conversation-row";
import { NewMatchesSection } from "./new-matches-section";

interface ChatsListProps {
  newMatches: MatchSummary[];
  conversations: MatchSummary[];
  now: number;
  bottomSpace: number;
  refreshControl: ReactElement<RefreshControlProps>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore(): Promise<void>;
  onOpen(match: MatchSummary): void;
  onScroll: NonNullable<ScrollViewProps["onScroll"]>;
}

const keepScrollOffset = { disabled: true } as const;

export function ChatsList({
  newMatches, conversations, now, bottomSpace, refreshControl, hasMore, loadingMore, onLoadMore, onOpen, onScroll
}: ChatsListProps) {
  const padding = useTheme().semantic.layout.screenPadding;
  const items = useMemo(() => buildChatsListItems(newMatches, conversations), [newMatches, conversations]);
  const renderItem = useCallback<ListRenderItem<ChatsListItem>>(({ item }) => {
    switch (item.type) {
      case "new-matches":
        return <NewMatchesSection matches={item.matches} now={now} onOpen={onOpen} />;
      case "heading":
        return (
          <View style={[styles.heading, { paddingHorizontal: padding }]} testID="chats-conversations">
            <Text role="heading" variant="title3">Mensajes</Text>
          </View>
        );
      case "conversation":
        return <GroupedConversationRow first={item.first} last={item.last} match={item.match} now={now} onOpen={onOpen} />;
      case "icebreak":
        return <IcebreakNote />;
    }
  }, [now, onOpen, padding]);

  return (
    <FlashList
      contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomSpace + 32 }}
      data={items}
      extraData={now}
      getItemType={chatsItemType}
      keyExtractor={chatsItemKey}
      ListFooterComponent={hasMore ? (
        <View style={[styles.footer, { paddingHorizontal: padding }]}>
          <Button
            disabled={loadingMore}
            label={loadingMore ? "Cargando chats…" : "Cargar más chats"}
            onPress={() => void onLoadMore()}
            testID="chats-load-more"
          />
        </View>
      ) : null}
      maintainVisibleContentPosition={keepScrollOffset}
      onScroll={onScroll}
      refreshControl={refreshControl}
      renderItem={renderItem}
      scrollEventThrottle={CHATS_PRESENTATION.scrollEventThrottleMs}
      showsVerticalScrollIndicator={false}
      testID="chats-list"
    />
  );
}

function IcebreakNote() {
  const padding = useTheme().semantic.layout.screenPadding;
  return (
    <View style={{ paddingHorizontal: padding }}>
      <StickyNote color="limonada" tape={{ color: "fresa", pattern: "hearts" }} testID="chats-icebreak-note" tilt={-1.5}>
        <View style={styles.note}>
          <Mascot animated={false} mood="wink" size={64} />
          <View style={styles.noteTexts}>
            <Text variant="title3">¡Rompe el hielo!</Text>
            <Text variant="hand">
              Toca a alguien de arriba y salúdale. Una pregunta sobre algo que tengáis en común funciona de maravilla.
            </Text>
          </View>
        </View>
      </StickyNote>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingBottom: 12 },
  footer: { paddingTop: 28 },
  note: { flexDirection: "row", alignItems: "center", gap: 14 },
  noteTexts: { flex: 1, gap: 4 }
});
