import { memo } from "react";
import { StyleSheet, View } from "react-native";

import type { DiscoveryMode } from "@snack/contracts";

import { IconButton, Logo, SegmentedControl } from "../../../shared/ui";

interface DiscoverHeaderProps {
  mode: DiscoveryMode;
  onModeChange(mode: DiscoveryMode): void;
  onOpenFilters(): void;
}

const MODE_OPTIONS = [
  { value: "swipe" as const, label: "Swipe", icon: "cards" as const, testID: "mode-swipe", accessibilityLabel: "Modo swipe: una persona cada vez" },
  { value: "feed" as const, label: "Feed", icon: "feed" as const, testID: "mode-feed", accessibilityLabel: "Modo feed: desliza hacia abajo" }
];

/** Logo pegatina «snack» + conmutador Swipe | Feed + filtros. */
export const DiscoverHeader = memo(function DiscoverHeader({ mode, onModeChange, onOpenFilters }: DiscoverHeaderProps) {
  return (
    <View style={styles.row}>
      <Logo height={40} testID="discover-logo" />
      <SegmentedControl
        accessibilityLabel="Cómo quieres descubrir"
        onChange={onModeChange}
        options={MODE_OPTIONS}
        size="sm"
        testID="discover-mode"
        value={mode}
      />
      <IconButton
        accessibilityHint="Edad, distancia y a quién quieres conocer. Todo gratis."
        accessibilityLabel="Filtros"
        icon="sliders"
        onPress={onOpenFilters}
        size="md"
        testID="discover-filters"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10
  }
});
