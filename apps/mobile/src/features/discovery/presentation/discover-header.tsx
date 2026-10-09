import { memo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

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

/** Por debajo de este ancho (Android compacto, iPhone mini/SE) todo se encoge un poco. */
const COMPACT_WIDTH = 380;

const MODE_OPTIONS_COMPACT = MODE_OPTIONS.map(({ icon: _icon, ...option }) => option);

/** Logo pegatina «snack» + conmutador Swipe | Feed + filtros. */
export const DiscoverHeader = memo(function DiscoverHeader({ mode, onModeChange, onOpenFilters }: DiscoverHeaderProps) {
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_WIDTH;

  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]}>
      <Logo height={compact ? 32 : 40} testID="discover-logo" />
      <SegmentedControl
        accessibilityLabel="Cómo quieres descubrir"
        onChange={onModeChange}
        options={compact ? MODE_OPTIONS_COMPACT : MODE_OPTIONS}
        size="sm"
        testID="discover-mode"
        value={mode}
      />
      <IconButton
        accessibilityHint="Edad, distancia y a quién quieres conocer."
        accessibilityLabel="Filtros"
        icon="sliders"
        onPress={onOpenFilters}
        size={compact ? "sm" : "md"}
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
  },
  rowCompact: {
    gap: 6,
    paddingHorizontal: 12
  }
});
