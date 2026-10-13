import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { Icon, type PastelName, Text, useTheme } from "../../../shared/ui";
import { MAX_BLOCKED_TAGS, MAX_POSITIVE_TAGS } from "../domain/tag-selection";
import { positiveTagsStatus } from "../domain/tag-status";

export interface TagSummaryProps {
  likedCount: number;
  blockedCount: number;
  /** Fondo opaco de la franja (el pastel suave de la página). */
  tone: PastelName;
  /** Sacudida del contador correspondiente al tocar con la lista llena (`useTagControls`). */
  likedShakeStyle?: object;
  blockedShakeStyle?: object;
  testID?: string;
}

/**
 * Franja fija arriba de la página de etiquetas: dos medidores de puntos (8 «me gusta»
 * en menta, 5 bloqueos en tomate) y, a la derecha, lo que falta para el mínimo.
 */
export const TagSummary = memo(function TagSummary({
  likedCount,
  blockedCount,
  tone: _tone,
  likedShakeStyle,
  blockedShakeStyle,
  testID = "tag-summary"
}: TagSummaryProps) {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: theme.semantic.color.screenBackground,
          borderBottomColor: c.ink,
          borderBottomWidth: theme.primitives.border.thin,
          paddingHorizontal: theme.semantic.layout.screenPadding
        }
      ]}
      testID={testID}
    >
      <Animated.View
        accessibilityLabel={`Me gustan ${likedCount} de ${MAX_POSITIVE_TAGS}`}
        accessible
        style={[styles.count, likedShakeStyle]}
        testID={`${testID}-liked`}
      >
        <Icon color={c.ink} fill={theme.semantic.tag.likedBackground} name="heart" size={16} />
        <Meter fill={theme.semantic.tag.likedBackground} total={MAX_POSITIVE_TAGS} value={likedCount} />
        <Text maxFontSizeMultiplier={1.3} style={styles.srOnly} testID={`${testID}-liked-count`} variant="caption">{`${likedCount}/${MAX_POSITIVE_TAGS}`}</Text>
      </Animated.View>
      <Animated.View
        accessibilityLabel={`Bloqueadas ${blockedCount} de ${MAX_BLOCKED_TAGS}, opcional`}
        accessible
        style={[styles.count, blockedShakeStyle]}
        testID={`${testID}-blocked`}
      >
        <Icon color={theme.semantic.tag.blockedForeground} name="x" size={16} strokeWidth={3} />
        <Meter fill={theme.primitives.pastel.tomate.fill} total={MAX_BLOCKED_TAGS} value={blockedCount} />
        <Text maxFontSizeMultiplier={1.3} style={styles.srOnly} testID={`${testID}-blocked-count`} variant="caption">{`${blockedCount}/${MAX_BLOCKED_TAGS}`}</Text>
      </Animated.View>
      <Text
        accessibilityLiveRegion="polite"
        align="right"
        color="muted"
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={styles.status}
        testID={`${testID}-status`}
        variant="caption"
      >
        {positiveTagsStatus(likedCount)}
      </Text>
    </View>
  );
});

/** Fila de puntos: rellenos hasta `value`, huecos hasta `total`. */
function Meter({ value, total, fill }: { value: number; total: number; fill: string }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  return (
    <View style={styles.meter}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            { borderColor: c.ink, borderWidth: theme.primitives.border.thin, backgroundColor: index < value ? fill : c.white }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingVertical: 8
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  meter: {
    flexDirection: "row",
    gap: 2
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5
  },
  /** El número sigue en el árbol (lectores de pantalla y tests) pero no se ve: lo cuentan los puntos. */
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0
  },
  status: {
    flex: 1,
    marginLeft: 4
  }
});
