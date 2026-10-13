import { memo, useEffect } from "react";
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { withAlpha } from "./color-utils";
import { Icon } from "./icon";

export type StampSize = "sm" | "md" | "lg";

export interface StampProps {
  /** Texto del sello («¡ME GUSTA!», «PASO», «¡MATCH!», «NUEVO»…). Se muestra en mayúsculas. */
  label: string;
  /** `ink` o un pastel (se usa su tono `deep`). */
  tone?: PastelName | "ink";
  /** Rectángulo redondeado con doble borde o sello circular. */
  shape?: "rounded" | "circle";
  /** Giro en grados (def. -8). */
  rotation?: number;
  size?: StampSize;
  /**
   * Papel detrás para leerse sobre fotos: `true` (def.) blanco translúcido, `"opaque"`
   * blanco macizo (nada asoma por debajo), `false` solo tinta.
   */
  backdrop?: boolean | "opaque";
  /** Cae de golpe al montarse (escala 1.6 → 1). Con «reducir movimiento», fundido. */
  slam?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZES: Record<StampSize, { fontSize: number; lineHeight: number; outer: number; inner: number; padX: number; padY: number }> = {
  sm: { fontSize: 15, lineHeight: 19, outer: 2.5, inner: 1.5, padX: 8, padY: 2 },
  md: { fontSize: 26, lineHeight: 31, outer: 3.5, inner: 2, padX: 12, padY: 3 },
  lg: { fontSize: 34, lineHeight: 40, outer: 4, inner: 2, padX: 16, padY: 4 }
};

/**
 * Sello de goma: tinta (o el `deep` de un pastel), doble borde con el interior
 * discontinuo y letras en Mochiy. El háptico lo pone quien lo muestra.
 */
export const Stamp = memo(function Stamp({
  label,
  tone = "ink",
  shape = "rounded",
  rotation = -8,
  size = "md",
  backdrop = true,
  slam = false,
  style,
  testID
}: StampProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const ink = tone === "ink" ? theme.primitives.color.ink : theme.primitives.pastel[tone].deep;
  const circle = shape === "circle";
  const base = SIZES[size];
  // En el sello circular la letra baja un punto para que el círculo no crezca de más.
  const metrics = circle
    ? { ...base, fontSize: Math.round(base.fontSize * 0.74), lineHeight: Math.round(base.lineHeight * 0.74), padX: base.padX * 0.7 }
    : base;

  const progress = useSharedValue(slam ? 0 : 1);
  const appear = useSharedValue(slam ? 0 : 1);

  useEffect(() => {
    if (!slam) {
      return;
    }
    appear.value = withTiming(1, { duration: reducedMotion ? 160 : 90, easing: Easing.out(Easing.quad) });
    progress.value = reducedMotion ? 1 : withSpring(1, theme.primitives.motion.spring.pop);
  }, [appear, progress, reducedMotion, slam, theme.primitives.motion.spring.pop]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { rotate: `${rotation - 7 * (1 - progress.value)}deg` },
      { scale: 1.6 - 0.6 * progress.value }
    ]
  }));

  const outerRadius = circle ? 999 : theme.primitives.radius.sm + 2;
  const innerRadius = circle ? 999 : theme.primitives.radius.xs;

  return (
    <Animated.View testID={testID} style={[styles.self, animatedStyle, style]}>
      <View
        style={[
          styles.outer,
          {
            borderColor: ink,
            borderWidth: metrics.outer,
            borderRadius: outerRadius,
            padding: circle ? metrics.outer + 1 : metrics.outer,
            backgroundColor:
              backdrop === "opaque"
                ? theme.primitives.color.white
                : backdrop
                  ? withAlpha(theme.primitives.color.white, 0.9)
                  : "transparent"
          }
        ]}
      >
        <View
          style={[
            styles.inner,
            circle && styles.circle,
            {
              borderColor: ink,
              borderWidth: metrics.inner,
              borderRadius: innerRadius,
              paddingHorizontal: metrics.padX,
              paddingVertical: circle ? metrics.padX : metrics.padY
            }
          ]}
        >
          {circle ? <Icon name="heart-filled" size={Math.round(metrics.fontSize * 0.86)} color={ink} style={styles.ornament} /> : null}
          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={{
              fontFamily: theme.primitives.fonts.display,
              fontSize: metrics.fontSize,
              lineHeight: metrics.lineHeight,
              letterSpacing: metrics.fontSize * 0.04,
              color: ink,
              textAlign: "center",
              textTransform: "uppercase"
            }}
          >
            {label}
          </Text>
          {circle ? (
            <Svg width={30} height={6} viewBox="0 0 30 6" style={styles.dots}>
              <Circle cx={5} cy={3} r={2} fill={ink} />
              <Circle cx={15} cy={3} r={2} fill={ink} />
              <Circle cx={25} cy={3} r={2} fill={ink} />
            </Svg>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  self: { alignSelf: "flex-start" },
  outer: { alignItems: "stretch" },
  inner: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  circle: { aspectRatio: 1, justifyContent: "center" },
  ornament: { marginBottom: 1 },
  dots: { marginTop: 6 }
});
