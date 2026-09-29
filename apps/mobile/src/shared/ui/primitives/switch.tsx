import { useEffect } from "react";
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptics } from "../motion/haptics";
import { springs } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { IconSlot } from "./icon-slot";

export interface SwitchProps {
  value: boolean;
  onValueChange?(value: boolean): void;
  disabled?: boolean;
  /** Color del carril encendido (por defecto menta). */
  color?: PastelName;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const TRACK_W = 58;
const TRACK_H = 34;
const THUMB = 24;

/**
 * Interruptor gordo: el pulgar se estira al pulsar y rebota al cambiar.
 * Encendido = carril pastel + pulgar a la derecha con ✓ (no solo color).
 */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  color = "menta",
  accessibilityLabel,
  accessibilityHint,
  testID,
  style
}: SwitchProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const border = theme.primitives.border.regular;
  const pad = (TRACK_H - 2 * border - THUMB) / 2;
  const travel = TRACK_W - 2 * border - 2 * pad - THUMB;
  const on = useSharedValue(value ? 1 : 0);
  const squish = useSharedValue(0);

  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, springs.pop);
  }, [on, value]);

  const offFill = c.paperDeep;
  const onFill = theme.primitives.pastel[color].fill;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(Math.min(Math.max(on.value, 0), 1), [0, 1], [offFill, onFill])
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    width: THUMB + squish.value * 6,
    transform: [{ translateX: on.value * travel - squish.value * 6 * on.value }]
  }));

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      aria-checked={value}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        onValueChange?.(!value);
      }}
      onPressIn={() => {
        squish.value = withSpring(1, springs.snappy);
      }}
      onPressOut={() => {
        squish.value = withSpring(0, springs.snappy);
      }}
      style={[{ opacity: disabled ? theme.primitives.opacity.disabled : 1 }, style]}
      testID={testID}
    >
      <View style={[styles.shadow, { borderRadius: TRACK_H / 2, backgroundColor: c.ink }]} />
      <Animated.View
        style={[
          styles.track,
          { borderWidth: border, borderColor: c.ink, borderRadius: TRACK_H / 2, paddingHorizontal: pad },
          trackStyle
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { borderWidth: border, borderColor: c.ink, backgroundColor: c.white, borderRadius: THUMB / 2 },
            thumbStyle
          ]}
        >
          {value ? <IconSlot color={c.ink} icon="check" size={14} /> : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    top: 2,
    left: 2,
    width: TRACK_W,
    height: TRACK_H
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    justifyContent: "center"
  },
  thumb: {
    height: THUMB,
    alignItems: "center",
    justifyContent: "center"
  }
});
