import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import type { IconName } from "../art";
import { haptics } from "../motion/haptics";
import { usePop } from "../motion/pop";
import { springs } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { IconSlot } from "./icon-slot";
import { Text } from "./text";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  accessibilityLabel?: string;
  testID?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange(value: NoInfer<T>): void;
  size?: "sm" | "md";
  /** Color del pulgar (por defecto limonada). */
  color?: PastelName;
  /** Ocupa todo el ancho disponible (si no, se ajusta al contenido). */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const PAD = 3;

/**
 * Pastilla neobrutal con un pulgar pastel que se desliza con muelle entre
 * opciones (p. ej. Swipe | Feed). Semántica de pestañas para lectores.
 */
export function SegmentedControl<const T extends string>({
  options,
  value,
  onChange,
  size = "md",
  color = "limonada",
  fullWidth = false,
  accessibilityLabel,
  testID,
  style
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const height = size === "sm" ? 40 : 48;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const [natural, setNatural] = useState<Record<string, number>>({});
  const segment = trackWidth / Math.max(options.length, 1);
  const widest = Math.max(0, ...Object.values(natural));
  const hugWidth = !fullWidth && Object.keys(natural).length === options.length ? widest : undefined;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * segment, springs.soft);
  }, [index, segment, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    if (width !== trackWidth) {
      x.value = index * (width / Math.max(options.length, 1));
      setTrackWidth(width);
    }
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[
        styles.outer,
        {
          height,
          borderRadius: height / 2,
          borderWidth: theme.primitives.border.regular,
          borderColor: c.ink,
          backgroundColor: c.white,
          alignSelf: fullWidth ? "stretch" : "flex-start"
        },
        theme.primitives.elevation.sm,
        style
      ]}
      testID={testID}
    >
      <View onLayout={handleLayout} style={styles.track}>
        {trackWidth > 0 ? (
          <Animated.View
            style={[
              styles.thumb,
              {
                width: segment,
                borderRadius: (height - 2 * theme.primitives.border.regular - 2 * PAD) / 2,
                borderWidth: theme.primitives.border.regular,
                borderColor: c.ink,
                backgroundColor: theme.primitives.pastel[color].fill
              },
              thumbStyle
            ]}
          />
        ) : null}
        {options.map((option) => (
          <Segment
            active={option.value === value}
            fullWidth={fullWidth}
            key={option.value}
            minWidth={hugWidth}
            onMeasure={(width) =>
              setNatural((current) =>
                (current[option.value] ?? 0) >= width ? current : { ...current, [option.value]: width }
              )
            }
            onPress={() => {
              if (option.value !== value) {
                haptics.selection();
                onChange(option.value);
              }
            }}
            option={option}
            size={size}
          />
        ))}
      </View>
    </View>
  );
}

function Segment<T extends string>({
  option,
  active,
  size,
  fullWidth,
  minWidth,
  onMeasure,
  onPress
}: {
  option: SegmentedOption<T>;
  active: boolean;
  size: "sm" | "md";
  fullWidth: boolean;
  minWidth?: number;
  onMeasure(width: number): void;
  onPress(): void;
}) {
  const theme = useTheme();
  const { pop, style: popStyle } = usePop({ from: 1.25, tilt: 8 });

  useEffect(() => {
    if (active) {
      pop();
    }
  }, [active, pop]);

  return (
    <Pressable
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityRole="tab"
      aria-selected={active}
      hitSlop={{ top: 4, bottom: 4 }}
      onLayout={fullWidth ? undefined : (event) => onMeasure(event.nativeEvent.layout.width)}
      onPress={onPress}
      style={[
        styles.segment,
        fullWidth ? styles.grow : { minWidth },
        { paddingHorizontal: fullWidth ? 8 : size === "sm" ? 14 : 18 }
      ]}
      testID={option.testID}
    >
      {option.icon ? (
        <Animated.View style={active ? popStyle : null}>
          <IconSlot
            color={theme.primitives.color.ink}
            fill={active ? theme.primitives.color.white : undefined}
            icon={option.icon}
            size={size === "sm" ? 16 : 18}
          />
        </Animated.View>
      ) : null}
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={styles.label}
        variant={size === "sm" ? "caption" : "label"}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    padding: PAD
  },
  track: {
    flexGrow: 1,
    flexDirection: "row",
    position: "relative"
  },
  thumb: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  grow: {
    flex: 1
  },
  label: {
    flexShrink: 1
  }
});
