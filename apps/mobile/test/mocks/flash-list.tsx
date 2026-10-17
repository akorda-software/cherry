import type { ReactNode } from "react";
import { View } from "react-native";

interface FlashListProps<T> {
  data: T[];
  renderItem(info: { item: T; index: number }): ReactNode;
  keyExtractor?(item: T, index: number): string;
  ListEmptyComponent?: ReactNode;
  ListHeaderComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  estimatedItemSize?: number;
  numColumns?: number;
  contentContainerStyle?: unknown;
  onEndReached?(): void;
  onEndReachedThreshold?: number;
}

export function FlashList<T>({
  data,
  renderItem,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent
}: FlashListProps<T>) {
  return (
    <View testID="flash-list">
      {ListHeaderComponent ?? null}
      {data.length === 0 && ListEmptyComponent ? ListEmptyComponent : null}
      {data.map((item, index) => (
        <View key={index}>{renderItem({ item, index })}</View>
      ))}
      {ListFooterComponent ?? null}
    </View>
  );
}
