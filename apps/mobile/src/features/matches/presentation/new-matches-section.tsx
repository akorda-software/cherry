import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";

import type { MatchSummary } from "@cherry/contracts";

import { Badge, Text, useTheme } from "../../../shared/ui";
import { matchItemKey } from "./chats-list-model";
import { NewMatchAvatar } from "./new-match-avatar";

interface NewMatchesSectionProps {
  matches: MatchSummary[];
  now: number;
  onOpen(match: MatchSummary): void;
}

const keepScrollOffset = { disabled: true } as const;
function AvatarSeparator() {
  return <View style={styles.separator} />;
}

export const NewMatchesSection = memo(function NewMatchesSection({ matches, now, onOpen }: NewMatchesSectionProps) {
  const theme = useTheme();
  const padding = theme.semantic.layout.screenPadding;
  const renderItem = useCallback<ListRenderItem<MatchSummary>>(
    ({ item, index }) => <NewMatchAvatar index={index} match={item} now={now} onOpen={onOpen} />,
    [now, onOpen]
  );

  return (
    <View style={styles.section} testID="chats-new-matches">
      <View style={[styles.title, { paddingHorizontal: padding }]}>
        <Text role="heading" variant="title3">Nuevos matches</Text>
        <Badge color="limonada" count={matches.length} />
      </View>
      <FlashList
        contentContainerStyle={{ paddingHorizontal: padding, paddingVertical: 6 }}
        data={matches}
        extraData={now}
        horizontal
        ItemSeparatorComponent={AvatarSeparator}
        keyExtractor={matchItemKey}
        maintainVisibleContentPosition={keepScrollOffset}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        testID="chats-new-matches-list"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: 12, paddingBottom: 28 },
  title: { flexDirection: "row", alignItems: "center", gap: 8 },
  separator: { width: 8 }
});
