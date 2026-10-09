import { useCallback, useEffect, useState } from "react";
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";

import { haptics } from "../motion/haptics";
import { springs } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { HardShadow } from "./hard-shadow";
import { Text } from "./text";

const THUMB = 30;
const TRACK_H = 14;
const BUBBLE_W = 72;
const BUBBLE_SPACE = 40;
const ZONE = 48;
/** El carril asoma un poco por fuera del centro de los pulgares en los extremos. */
const TRACK_INSET = THUMB / 2 - 4;

type LabelMode = "drag" | "always" | "none";

interface SharedSliderProps {
  min: number;
  max: number;
  step?: number;
  /** Cómo se escribe un valor (por defecto el número). */
  formatLabel?(value: number): string;
  /** Pegatina con el valor sobre el pulgar: al arrastrar (por defecto), siempre o nunca. */
  labels?: LabelMode;
  color?: PastelName;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export interface RangeSliderProps extends SharedSliderProps {
  low: number;
  high: number;
  /** Separación mínima entre los dos valores. */
  minGap?: number;
  /** Mientras se arrastra (cada paso). */
  onChange?(low: number, high: number): void;
  /** Al soltar. */
  onChangeEnd?(low: number, high: number): void;
  /** Nombres accesibles de cada pulgar. */
  lowLabel?: string;
  highLabel?: string;
}

export interface SliderProps extends SharedSliderProps {
  value: number;
  onChange?(value: number): void;
  onChangeEnd?(value: number): void;
  accessibilityLabel?: string;
}

function snap(px: number, width: number, min: number, max: number, step: number) {
  "worklet";
  if (width <= 0) {
    return min;
  }
  const raw = min + (px / width) * (max - min);
  const snapped = Math.round((raw - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

function toPx(value: number, width: number, min: number, max: number) {
  "worklet";
  if (max <= min) {
    return 0;
  }
  return ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * width;
}

/** Doble pulgar (edad, distancia…). Arrastra o usa los gestos de accesibilidad. */
export function RangeSlider(props: RangeSliderProps) {
  return <SliderCore {...props} mode="range" />;
}

/** Un pulgar (distancia máxima…). */
export function Slider({ value, onChange, onChangeEnd, accessibilityLabel, ...rest }: SliderProps) {
  return (
    <SliderCore
      {...rest}
      high={value}
      highLabel={accessibilityLabel}
      low={rest.min}
      mode="single"
      onChange={onChange ? (_low, high) => onChange(high) : undefined}
      onChangeEnd={onChangeEnd ? (_low, high) => onChangeEnd(high) : undefined}
    />
  );
}

function SliderCore({
  min,
  max,
  low,
  high,
  step = 1,
  minGap = 0,
  onChange,
  onChangeEnd,
  formatLabel = (value: number) => String(value),
  labels = "drag",
  color = "fresa",
  disabled = false,
  lowLabel = "Mínimo",
  highLabel = "Máximo",
  testID,
  style,
  mode
}: RangeSliderProps & { mode: "range" | "single" }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const [width, setWidth] = useState(0);
  const [live, setLive] = useState({ low, high });
  const lowPx = useSharedValue(0);
  const highPx = useSharedValue(0);
  const lowValue = useSharedValue(low);
  const highValue = useSharedValue(high);
  const dragging = useSharedValue(0);
  const startX = useSharedValue(0);
  const range = mode === "range";

  useEffect(() => {
    if (dragging.value !== 0) {
      return;
    }
    lowValue.value = low;
    highValue.value = high;
    lowPx.value = withSpring(toPx(low, width, min, max), springs.snappy);
    highPx.value = withSpring(toPx(high, width, min, max), springs.snappy);
    setLive({ low, high });
  }, [dragging, high, highPx, highValue, low, lowPx, lowValue, max, min, width]);

  const emit = useCallback(
    (nextLow: number, nextHigh: number) => {
      setLive({ low: nextLow, high: nextHigh });
      haptics.selection();
      onChange?.(nextLow, nextHigh);
    },
    [onChange]
  );

  const emitEnd = useCallback(
    (nextLow: number, nextHigh: number) => {
      onChangeEnd?.(nextLow, nextHigh);
    },
    [onChangeEnd]
  );

  function handleLayout(event: LayoutChangeEvent) {
    const usable = Math.max(0, event.nativeEvent.layout.width - THUMB);
    if (usable !== width) {
      lowPx.value = toPx(lowValue.value, usable, min, max);
      highPx.value = toPx(highValue.value, usable, min, max);
      setWidth(usable);
    }
  }

  function makePan(which: 1 | 2, px: SharedValue<number>, value: SharedValue<number>) {
    return Gesture.Pan()
      .enabled(!disabled && width > 0)
      .minDistance(1)
      .hitSlop({ horizontal: 12, vertical: 14 })
      .onStart(() => {
        startX.value = px.value;
        dragging.value = which;
      })
      .onUpdate((event) => {
        const lower = which === 2 && range ? lowPx.value : 0;
        const upper = which === 1 ? highPx.value : width;
        const next = Math.min(upper, Math.max(lower, startX.value + event.translationX));
        px.value = next;
        let v = snap(next, width, min, max, step);
        if (which === 1) {
          v = Math.min(v, highValue.value - minGap);
        } else if (range) {
          v = Math.max(v, lowValue.value + minGap);
        }
        if (v !== value.value) {
          value.value = v;
          runOnJS(emit)(lowValue.value, highValue.value);
        }
      })
      .onEnd(() => {
        px.value = withSpring(toPx(value.value, width, min, max), springs.snappy);
        runOnJS(emitEnd)(lowValue.value, highValue.value);
      })
      .onFinalize(() => {
        dragging.value = 0;
      });
  }

  const lowPan = makePan(1, lowPx, lowValue);
  const highPan = makePan(2, highPx, highValue);

  function nudge(which: 1 | 2, direction: 1 | -1) {
    const nextLow = which === 1 ? Math.min(Math.max(min, live.low + direction * step), live.high - minGap) : live.low;
    const nextHigh =
      which === 2 ? Math.max(Math.min(max, live.high + direction * step), range ? live.low + minGap : min) : live.high;
    lowValue.value = nextLow;
    highValue.value = nextHigh;
    lowPx.value = withSpring(toPx(nextLow, width, min, max), springs.snappy);
    highPx.value = withSpring(toPx(nextHigh, width, min, max), springs.snappy);
    emit(nextLow, nextHigh);
    emitEnd(nextLow, nextHigh);
  }

  const fillStyle = useAnimatedStyle(() => ({
    left: range ? lowPx.value + THUMB / 2 : TRACK_INSET,
    width: Math.max(0, range ? highPx.value - lowPx.value : highPx.value + THUMB / 2 - TRACK_INSET)
  }));
  const lowThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lowPx.value }, { scale: dragging.value === 1 ? 1.12 : 1 }]
  }));
  const highThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highPx.value }, { scale: dragging.value === 2 ? 1.12 : 1 }]
  }));
  const lowBubbleStyle = useAnimatedStyle(() => ({
    opacity: labels === "always" || dragging.value === 1 ? 1 : 0,
    transform: [{ translateX: lowPx.value + THUMB / 2 - BUBBLE_W / 2 }, { scale: dragging.value === 1 ? 1.08 : 1 }]
  }));
  const highBubbleStyle = useAnimatedStyle(() => ({
    opacity: labels === "always" || dragging.value === 2 ? 1 : 0,
    transform: [{ translateX: highPx.value + THUMB / 2 - BUBBLE_W / 2 }, { scale: dragging.value === 2 ? 1.08 : 1 }]
  }));

  const thumbFace = {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: theme.primitives.border.bold,
    borderColor: disabled ? c.inkFaint : c.ink,
    backgroundColor: c.white
  };

  function thumb(which: 1 | 2) {
    const value = which === 1 ? live.low : live.high;
    return (
      <GestureDetector gesture={which === 1 ? lowPan : highPan}>
        <Animated.View
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          accessibilityLabel={which === 1 ? lowLabel : highLabel}
          accessibilityRole="adjustable"
          accessibilityValue={{ min, max, now: value, text: formatLabel(value) }}
          accessible
          onAccessibilityAction={(event: AccessibilityActionEvent) =>
            nudge(which, event.nativeEvent.actionName === "increment" ? 1 : -1)
          }
          style={[styles.thumbSlot, which === 1 ? lowThumbStyle : highThumbStyle]}
          testID={testID ? `${testID}-${which === 1 ? "low" : "high"}` : undefined}
        >
          <View style={[styles.thumbShadow, { backgroundColor: c.ink, borderRadius: THUMB / 2 }]} />
          <View style={thumbFace} />
        </Animated.View>
      </GestureDetector>
    );
  }

  function bubble(which: 1 | 2) {
    const value = which === 1 ? live.low : live.high;
    return (
      <Animated.View
        style={[styles.bubble, which === 1 ? lowBubbleStyle : highBubbleStyle]}
        importantForAccessibility="no-hide-descendants"
      >
        <HardShadow
          elevation="xs"
          style={[
            styles.bubbleFace,
            {
              backgroundColor: theme.primitives.pastel[color].soft,
              borderColor: c.ink,
              borderWidth: theme.primitives.border.thin,
              borderRadius: theme.primitives.radius.pill
            }
          ]}
        >
          <Text numberOfLines={1} variant="caption">
            {formatLabel(value)}
          </Text>
        </HardShadow>
      </Animated.View>
    );
  }

  return (
    <View
      style={[styles.root, { paddingTop: labels === "always" ? BUBBLE_SPACE : 0, opacity: disabled ? 0.6 : 1 }, style]}
      testID={testID}
    >
      <View onLayout={handleLayout} style={styles.zone}>
        <HardShadow
          elevation="sm"
          style={[
            styles.track,
            {
              borderRadius: TRACK_H / 2,
              borderWidth: theme.primitives.border.regular,
              borderColor: c.ink,
              backgroundColor: c.white
            }
          ]}
        />
        <Animated.View
          style={[
            styles.fill,
            {
              borderRadius: TRACK_H / 2,
              borderWidth: theme.primitives.border.regular,
              borderColor: c.ink,
              backgroundColor: disabled ? c.paperDeep : theme.primitives.pastel[color].fill
            },
            fillStyle
          ]}
        />
        {labels !== "none" && range ? bubble(1) : null}
        {labels !== "none" ? bubble(2) : null}
        {range ? thumb(1) : null}
        {thumb(2)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: "stretch"
  },
  zone: {
    height: ZONE
  },
  track: {
    position: "absolute",
    top: (ZONE - TRACK_H) / 2,
    left: TRACK_INSET,
    right: TRACK_INSET,
    height: TRACK_H
  },
  fill: {
    position: "absolute",
    top: (ZONE - TRACK_H) / 2,
    height: TRACK_H
  },
  thumbSlot: {
    position: "absolute",
    top: (ZONE - THUMB) / 2,
    left: 0,
    width: THUMB,
    height: THUMB
  },
  thumbShadow: {
    position: "absolute",
    top: 2,
    left: 2,
    width: THUMB,
    height: THUMB
  },
  bubble: {
    position: "absolute",
    left: 0,
    bottom: ZONE - 6,
    width: BUBBLE_W,
    alignItems: "center",
    pointerEvents: "none"
  },
  bubbleFace: {
    paddingHorizontal: 10,
    paddingVertical: 3
  }
});
