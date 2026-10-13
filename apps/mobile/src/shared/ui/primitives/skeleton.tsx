import { LinearGradient } from "expo-linear-gradient";
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import { type DimensionValue, type LayoutChangeEvent, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { withAlpha } from "../utils/color";

const ShimmerClock = createContext<SharedValue<number> | null>(null);
const BAND = 120;
const CYCLE_MS = 1400;

function useShimmerClock(enabled: boolean) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    t.value = withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.inOut(Easing.quad) }), -1, false);

    return () => cancelAnimation(t);
  }, [enabled, t]);

  return t;
}

/** Comparte un único reloj de brillo entre varios esqueletos (van a la par). */
export function SkeletonGroup({ children }: PropsWithChildren) {
  const clock = useShimmerClock(true);
  return <ShimmerClock.Provider value={clock}>{children}</ShimmerClock.Provider>;
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  /** Círculo de ese diámetro (avatares). */
  circle?: number;
  color?: PastelName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Bloque de carga pastel con un brillo que lo recorre. Con «reducir
 * movimiento» solo late suavemente.
 */
export function Skeleton({ width = "100%", height = 16, radius, circle, color = "lavanda", style, testID }: SkeletonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const shared = useContext(ShimmerClock);
  const own = useShimmerClock(shared === null);
  const t = shared ?? own;
  const [measured, setMeasured] = useState(0);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : 1,
    transform: [{ translateX: -BAND + t.value * (measured + BAND * 2) }]
  }));

  const pulseStyle = useAnimatedStyle(() => {
    if (!reduced) {
      return { opacity: 1 };
    }
    const wave = t.value < 0.5 ? t.value * 2 : (1 - t.value) * 2;
    return { opacity: 0.55 + 0.45 * wave };
  });

  const size = circle ?? undefined;
  const white = theme.primitives.color.white;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout.width)}
      style={[
        styles.block,
        {
          width: size ?? width,
          height: size ?? height,
          borderRadius: size ? size / 2 : (radius ?? theme.primitives.radius.sm),
          backgroundColor: theme.primitives.pastel[color].soft
        },
        pulseStyle,
        style
      ]}
      testID={testID}
    >
      <Animated.View style={[styles.shine, shineStyle]}>
        <LinearGradient
          colors={[withAlpha(white, 0), withAlpha(white, 0.75), withAlpha(white, 0)]}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  /** Ancho de la última línea (las demás ocupan todo). */
  lastLineWidth?: DimensionValue;
  color?: PastelName;
  style?: StyleProp<ViewStyle>;
}

/** Párrafo de carga: varias líneas con la última más corta. */
export function SkeletonText({ lines = 3, lineHeight = 14, gap = 10, lastLineWidth = "62%", color, style }: SkeletonTextProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          color={color}
          height={lineHeight}
          key={index}
          radius={lineHeight / 2}
          width={index === lines - 1 && lines > 1 ? lastLineWidth : "100%"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: "hidden"
  },
  shine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: BAND
  }
});
