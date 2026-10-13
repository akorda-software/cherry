import { StyleSheet, View } from "react-native";

import { Skeleton, SkeletonGroup, useTheme } from "../../../shared/ui";

/** Esqueleto de la rejilla de polaroids mientras llegan los likes. */
export function LikesSkeleton({ columns, cardWidth, gap }: { columns: number; cardWidth: number; gap: number }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const count = columns * 2;

  return (
    <SkeletonGroup>
      <View
        accessibilityLabel="Cargando tus likes"
        accessibilityRole="progressbar"
        style={[styles.grid, { columnGap: gap, rowGap: gap + 24 }]}
        testID="likes-loading"
      >
        {Array.from({ length: count }, (_, index) => (
          <View
            key={index}
            style={[
              styles.frame,
              {
                width: cardWidth,
                backgroundColor: c.white,
                borderColor: c.dot,
                borderWidth: theme.primitives.border.regular,
                borderRadius: theme.primitives.radius.xs,
                transform: [{ rotate: `${index % 2 === 0 ? -1.2 : 1.1}deg` }]
              }
            ]}
          >
            <Skeleton color={index % 2 === 0 ? "fresa" : "lavanda"} height={(cardWidth - 16) * 1.25} radius={3} />
            <Skeleton height={16} radius={8} width="72%" />
            <Skeleton color="menta" height={22} radius={11} width="52%" />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  frame: {
    gap: 10,
    padding: 8,
    paddingBottom: 40
  }
});
