import { type ReactElement, useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";

import type { DiscoveryProfileCard } from "@snack/contracts";

import { useTheme } from "../../../shared/ui";
import { ProfileFeedCard } from "./profile-feed-card";

interface ProfileFeedGridProps {
  profiles: DiscoveryProfileCard[];
  hasMore: boolean;
  loadingMore: boolean;
  onOpenCard(card: DiscoveryProfileCard): void;
  onLoadMore(): void;
  ListEmptyComponent?: ReactElement;
}

export function ProfileFeedGrid({
  profiles,
  hasMore,
  loadingMore,
  onOpenCard,
  onLoadMore,
  ListEmptyComponent
}: ProfileFeedGridProps) {
  const theme = useTheme();

  const gap = theme.primitives.spacing.sm;
  const edge = theme.primitives.spacing.sm;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {
          padding: edge
        },
        cell: {
          paddingHorizontal: gap / 2,
          paddingBottom: gap
        },
        footer: {
          paddingVertical: theme.primitives.spacing.lg,
          alignItems: "center"
        }
      }),
    [edge, gap, theme]
  );

  const renderItem = useCallback(
    ({ item }: { item: DiscoveryProfileCard }) => (
      <View style={styles.cell}>
        <ProfileFeedCard card={item} onPress={onOpenCard} />
      </View>
    ),
    [onOpenCard, styles.cell]
  );

  const keyExtractor = useCallback((item: DiscoveryProfileCard) => item.id, []);

  const footer = hasMore || loadingMore ? (
    <View style={styles.footer}>
      <ActivityIndicator testID="discovery-loading-more" />
    </View>
  ) : null;

  return (
    <FlashList
      data={profiles}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      contentContainerStyle={styles.list}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={footer}
    />
  );
}
