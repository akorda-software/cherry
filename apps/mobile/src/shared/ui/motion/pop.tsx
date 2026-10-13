import { type PropsWithChildren, useCallback, useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { springs, timings } from "./springs";

export interface UsePopOptions {
  /** Giro final en grados (las pegatinas rara vez están rectas). */
  rotate?: number;
  /** Escala desde la que se asienta al hacer pop (1.12 = despegar y pegar). */
  from?: number;
  /** Grados extra de giro al despegar; se asientan en `rotate`. */
  tilt?: number;
}

/**
 * Pop de pegatina: la escala salta a `from` y se asienta con `spring.pop`
 * mientras el giro vuelve a su sitio. `pop()` se puede llamar desde eventos.
 */
export function usePop({ rotate = 0, from = 1.12, tilt = 5 }: UsePopOptions = {}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const turn = useSharedValue(rotate);

  useEffect(() => {
    turn.value = withSpring(rotate, springs.pop);
  }, [rotate, turn]);

  const pop = useCallback(
    (direction: 1 | -1 = 1) => {
      if (reduced) {
        return;
      }

      scale.value = from;
      scale.value = withSpring(1, springs.pop);
      turn.value = rotate + tilt * direction;
      turn.value = withSpring(rotate, springs.pop);
    },
    [from, reduced, rotate, scale, tilt, turn]
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }, { scale: scale.value }]
  }));

  return { pop, style, scale };
}

export interface PopInProps {
  delay?: number;
  /** Giro final en grados. */
  rotate?: number;
  /** Escala inicial (nunca 0: nada aparece de la nada). */
  fromScale?: number;
  /** Cambia este valor para repetir la entrada. */
  trigger?: unknown;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Entrada de pegatina: aparece pequeña y girada y se pega con rebote. */
export function PopIn({
  children,
  delay = 0,
  rotate = 0,
  fromScale = 0.6,
  trigger,
  style,
  testID
}: PropsWithChildren<PopInProps>) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduced ? 1 : fromScale);
  const turn = useSharedValue(reduced ? rotate : rotate - 10);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withDelay(delay, withTiming(1, timings.quick));

    if (reduced) {
      scale.value = 1;
      turn.value = rotate;
      return;
    }

    scale.value = fromScale;
    turn.value = rotate - 10;
    scale.value = withDelay(delay, withSpring(1, springs.pop));
    turn.value = withDelay(delay, withSpring(rotate, springs.pop));
  }, [delay, fromScale, opacity, reduced, rotate, scale, trigger, turn]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${turn.value}deg` }, { scale: scale.value }]
  }));

  return (
    <Animated.View style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}

/** Ejecuta `effect` solo cuando `value` cambia después del primer render. */
export function useOnChange<T>(value: T, effect: (value: T, previous: T) => void) {
  const previous = useRef(value);

  useEffect(() => {
    if (!Object.is(previous.current, value)) {
      const before = previous.current;
      previous.current = value;
      effect(value, before);
    }
  });
}
