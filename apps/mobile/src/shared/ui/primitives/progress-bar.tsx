import { useEffect, useMemo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { usePop } from "../motion/pop";
import { springs } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { HardShadow } from "./hard-shadow";

export interface ProgressBarProps {
  /** 0–1 en modo continuo; nº de segmentos completados (o en curso) si hay `segments`. */
  value: number;
  /** Divide la barra en pasos (onboarding). */
  segments?: number;
  color?: PastelName;
  size?: "sm" | "md" | "lg";
  /** Rayas animadas en el relleno (por defecto sí). */
  striped?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const STRIPE_GAP = 12;

/** Barra de progreso gorda con relleno rayado que avanza. */
export function ProgressBar({
  value,
  segments,
  color = "fresa",
  size = "md",
  striped = true,
  accessibilityLabel,
  testID,
  style
}: ProgressBarProps) {
  const theme = useTheme();
  const height = size === "sm" ? 12 : size === "lg" ? 24 : 18;

  if (segments && segments > 0) {
    const done = Math.max(0, Math.min(segments, Math.round(value)));

    return (
      <View
        accessibilityLabel={accessibilityLabel ?? `Paso ${done} de ${segments}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: segments, now: done }}
        style={[styles.segments, style]}
        testID={testID}
      >
        {Array.from({ length: segments }, (_, index) => (
          <Segment
            color={color}
            current={index === done - 1}
            filled={index < done}
            height={height}
            key={index}
            striped={striped}
          />
        ))}
      </View>
    );
  }

  const clamped = Math.max(0, Math.min(1, value));

  return (
    <HardShadow
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      elevation="sm"
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          borderWidth: theme.primitives.border.regular,
          borderColor: theme.primitives.color.ink,
          backgroundColor: theme.primitives.color.white
        },
        style
      ]}
      testID={testID}
    >
      <Fill color={color} striped={striped} value={clamped} />
    </HardShadow>
  );
}

function Fill({ value, color, striped }: { value: number; color: PastelName; striped: boolean }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(value, springs.soft);
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`
  }));

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          backgroundColor: theme.primitives.pastel[color].fill,
          borderRightWidth: value > 0 && value < 1 ? theme.primitives.border.regular : 0,
          borderColor: theme.primitives.color.ink
        },
        fillStyle
      ]}
    >
      {striped ? <MovingStripes trigger={value} /> : null}
    </Animated.View>
  );
}

function Segment({
  filled,
  current,
  height,
  color,
  striped
}: {
  filled: boolean;
  current: boolean;
  height: number;
  color: PastelName;
  striped: boolean;
}) {
  const theme = useTheme();
  const { pop, style: popStyle } = usePop({ from: 1.18, tilt: 0 });

  useEffect(() => {
    if (filled) {
      pop();
    }
  }, [filled, pop]);

  return (
    <HardShadow
      animatedStyle={popStyle}
      elevation={filled ? "sm" : "none"}
      style={[
        styles.segment,
        {
          height,
          borderRadius: height / 2,
          borderWidth: theme.primitives.border.regular,
          borderColor: theme.primitives.color.ink,
          backgroundColor: filled ? theme.primitives.pastel[color].fill : theme.primitives.color.white
        }
      ]}
    >
      {filled && current && striped ? <MovingStripes /> : null}
    </HardShadow>
  );
}

/**
 * Rayas blancas diagonales que avanzan dos pasos cada vez que cambia `trigger` y se
 * quedan quietas (nunca en bucle: una animación infinita repinta a 60 fps sin parar).
 * Quietas con «reducir movimiento».
 */
function MovingStripes({ trigger }: { trigger?: unknown }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const shift = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      return;
    }

    shift.value = 0;
    shift.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), 2, false);

    return () => cancelAnimation(shift);
  }, [reduced, shift, trigger]);

  const d = useMemo(() => {
    let path = "";
    for (let x = -40; x < 720; x += STRIPE_GAP) {
      path += `M${x} 40L${x + 40} 0`;
    }
    return path;
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -STRIPE_GAP * shift.value }] }));

  return (
    <Animated.View style={[styles.stripes, animatedStyle]}>
      <Svg height={40} width={720}>
        <Path d={d} opacity={0.45} stroke={theme.primitives.color.white} strokeWidth={4} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
    justifyContent: "center"
  },
  fill: {
    height: "100%",
    overflow: "hidden"
  },
  segments: {
    flexDirection: "row",
    gap: 6
  },
  segment: {
    flex: 1,
    overflow: "hidden"
  },
  stripes: {
    position: "absolute",
    top: -10,
    left: 0,
    pointerEvents: "none"
  }
});
