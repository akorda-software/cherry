import { useEffect } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { easings } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";

export interface LoadingDotsProps {
  color?: string;
  /** Diámetro de cada punto. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** Tres puntitos que rebotan (botones cargando, «escribiendo…»). */
export function LoadingDots({ color, size = 7, style, accessibilityLabel = "Cargando", testID }: LoadingDotsProps) {
  const theme = useTheme();
  const tint = color ?? theme.semantic.text.default;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      style={[styles.row, { gap: Math.round(size * 0.7) }, style]}
      testID={testID}
    >
      {[0, 1, 2].map((index) => (
        <Dot color={tint} index={index} key={index} size={size} />
      ))}
    </View>
  );
}

function Dot({ color, index, size }: { color: string; index: number; size: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    const cycle = withSequence(
      withTiming(1, { duration: 260, easing: easings.out }),
      withTiming(0, { duration: 260, easing: easings.inOut }),
      withTiming(0, { duration: 240 })
    );
    t.value = withDelay(index * 130, withRepeat(cycle, -1, false));

    return () => cancelAnimation(t);
  }, [index, t]);

  const animatedStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 0.45 + 0.55 * t.value }
      : { transform: [{ translateY: -size * 0.75 * t.value }] }
  );

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  }
});
