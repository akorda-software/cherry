import { type PropsWithChildren, useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { easings, springs, useBootSplashCovering } from "../../../shared/ui";

/** Escalón entre piezas de la bienvenida: logo → nombre → frase → botones. */
export const LOGIN_STAGGER_MS = 90;
/** Tras el splash, espera a que casi se haya fundido (para no ver dos Mochis a la vez). */
const AFTER_SPLASH_MS = 200;

export interface RiseProps {
  /** Retardo en ms desde que se monta la pantalla. */
  delay?: number;
  /** Cuánto sube al entrar (pt). */
  distance?: number;
  /** Además crece un poco (el logo). */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Entrada escalonada de la bienvenida: funde y sube unos pocos puntos, con una curva de salida. Con
 * «reducir movimiento» ya está en su sitio desde el primer fotograma (ni fundido ni desplazamiento).
 * En el arranque en frío espera a que el splash empiece a fundirse, para no gastarse debajo de él.
 * `collapsable={false}`: su opacidad y su transformación cambian, y Fabric no debe aplanarla al
 * acabar (aplanar y desaplanar una vista montada reparenta a sus hijos y tumba la app en Android).
 */
export function Rise({ children, delay = 0, distance = 12, grow = false, style, testID }: PropsWithChildren<RiseProps>) {
  const reduced = useReducedMotion();
  const covered = useBootSplashCovering();
  const afterSplash = useRef(false);
  if (covered) {
    afterSplash.current = true;
  }
  const fade = useSharedValue(reduced ? 1 : 0);
  const lift = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      fade.value = 1;
      lift.value = 1;
      return;
    }
    if (covered) {
      fade.value = 0;
      lift.value = 0;
      return;
    }
    const wait = delay + (afterSplash.current ? AFTER_SPLASH_MS : 0);
    fade.value = withDelay(wait, withTiming(1, { duration: 420, easing: easings.out }));
    lift.value = withDelay(wait, withSpring(1, springs.soft));
  }, [covered, delay, fade, lift, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - lift.value) * distance }, { scale: grow ? 0.9 + lift.value * 0.1 : 1 }]
  }));

  return (
    <Animated.View collapsable={false} style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}
