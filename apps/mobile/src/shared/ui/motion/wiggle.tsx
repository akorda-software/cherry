import { type PropsWithChildren, useCallback, useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { haptics } from "./haptics";
import { easings, springs } from "./springs";

export interface WiggleProps {
  /** Mientras sea `true` se balancea en bucle (p. ej. algo que pide atención). */
  active?: boolean;
  /** Cambia este valor para un meneo único. */
  trigger?: unknown;
  /** Amplitud en grados. */
  amplitude?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Meneo de pegatina (giro corto). Con «reducir movimiento» se queda quieta. */
export function Wiggle({ children, active = false, trigger, amplitude = 4, style, testID }: PropsWithChildren<WiggleProps>) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduced || trigger === undefined) {
      return;
    }

    turn.value = withSequence(
      withTiming(-amplitude, { duration: 70, easing: easings.out }),
      withTiming(amplitude, { duration: 110, easing: easings.inOut }),
      withTiming(-amplitude * 0.5, { duration: 100, easing: easings.inOut }),
      withSpring(0, springs.pop)
    );
  }, [amplitude, reduced, trigger, turn]);

  useEffect(() => {
    if (reduced) {
      return;
    }

    if (active) {
      turn.value = withRepeat(
        withSequence(
          withTiming(-amplitude, { duration: 160, easing: easings.inOut }),
          withTiming(amplitude, { duration: 160, easing: easings.inOut })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(turn);
      turn.value = withSpring(0, springs.pop);
    }
  }, [active, amplitude, reduced, turn]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.View style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}

export interface UseShakeOptions {
  /** Desplazamiento máximo en px. */
  distance?: number;
  /** Háptico de error al sacudir (por defecto sí). */
  haptic?: boolean;
}

/**
 * Sacudida de error («así no»): `const { shake, style } = useShake()` y
 * aplica `style` a un `Animated.View`.
 */
export function useShake({ distance = 8, haptic = true }: UseShakeOptions = {}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);

  const shake = useCallback(() => {
    if (haptic) {
      haptics.error();
    }

    if (reduced) {
      return;
    }

    offset.value = withSequence(
      withTiming(-distance, { duration: 45 }),
      withTiming(distance, { duration: 70 }),
      withTiming(-distance * 0.65, { duration: 65 }),
      withTiming(distance * 0.35, { duration: 60 }),
      withTiming(0, { duration: 55 })
    );
  }, [distance, haptic, offset, reduced]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return { shake, style };
}
