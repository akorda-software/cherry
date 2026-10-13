import { type PropsWithChildren, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { type SpringName, springs, timings } from "./springs";

export type AppearFrom = "bottom" | "top" | "left" | "right" | "scale" | "none";

export interface AppearProps {
  /** Retardo en ms (usa `stagger(index)` para listas). */
  delay?: number;
  /** Desde dónde entra: desliza (bottom/top/left/right), crece (scale) o solo funde (none). */
  from?: AppearFrom;
  /** Distancia del deslizamiento en px. */
  distance?: number;
  spring?: SpringName;
  style?: StyleProp<ViewStyle>;
  /** Cambia este valor para repetir la entrada. */
  trigger?: unknown;
  testID?: string;
}

/**
 * Entrada de papel: funde y se asienta (spring.soft). Con «reducir
 * movimiento» solo funde, sin desplazamiento.
 */
export function Appear({
  children,
  delay = 0,
  from = "bottom",
  distance = 14,
  spring = "soft",
  style,
  trigger,
  testID
}: PropsWithChildren<AppearProps>) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    opacity.value = 0;
    progress.value = reduced ? 1 : 0;
    opacity.value = withDelay(delay, withTiming(1, reduced ? timings.quick : timings.calm));

    if (!reduced) {
      progress.value = withDelay(delay, withSpring(1, springs[spring]));
    }
  }, [delay, opacity, progress, reduced, spring, trigger]);

  const animatedStyle = useAnimatedStyle(() => {
    const rest = 1 - progress.value;

    switch (from) {
      case "top":
        return { opacity: opacity.value, transform: [{ translateY: -distance * rest }] };
      case "left":
        return { opacity: opacity.value, transform: [{ translateX: -distance * rest }] };
      case "right":
        return { opacity: opacity.value, transform: [{ translateX: distance * rest }] };
      case "scale":
        return { opacity: opacity.value, transform: [{ scale: 1 - 0.06 * rest }] };
      case "none":
        return { opacity: opacity.value };
      default:
        return { opacity: opacity.value, transform: [{ translateY: distance * rest }] };
    }
  });

  return (
    <Animated.View style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}
