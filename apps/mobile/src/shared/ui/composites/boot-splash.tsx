import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import Svg from "react-native-svg";

import {
  MASCOT_CANVAS,
  MASCOT_EYES,
  MASCOT_VIEWBOX,
  MascotBody,
  MascotLoveEye,
  mascotStroke,
  useMascotPalette
} from "../art/mascot";
import { easings, springs } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";

/**
 * Ancho del logo en el splash nativo (`imageWidth` de expo-splash-screen en app.config.ts) y cómo
 * está Mochi dentro de `splash-icon.png` (1024 px): escala del lienzo de 120 y centro del círculo que
 * la envuelve, que es lo que queda en el centro de la pantalla. Con ellos, la Mochi de JS cae justo
 * encima de la nativa y el relevo no se nota.
 */
export const SPLASH_IMAGE_WIDTH = 200;
const SPLASH_ICON_SCALE = 478 / 57.5;
const SPLASH_ICON_CENTER = { x: 62.6, y: 57.9 };
export const BOOT_SPLASH_MASCOT_SIZE = (MASCOT_CANVAS * SPLASH_ICON_SCALE * SPLASH_IMAGE_WIDTH) / 1024;

/** Trazo con el que están dibujados los iconos (el de Mochi a 120 pt). */
const BRAND_STROKE = mascotStroke(MASCOT_CANVAS);

/** Lo que dura la entrada: saltito, balanceo y latido de los ojos de corazón. */
export const BOOT_SPLASH_INTRO_MS = 760;
/** Fundido final hacia la app. */
export const BOOT_SPLASH_EXIT_MS = 280;
/** Si la app sigue sin estar lista pasado este tiempo tras la entrada, se aparta igualmente. */
export const BOOT_SPLASH_MAX_WAIT_MS = 2500;

export interface BootSplashProps {
  /** La app ya sabe qué pantalla enseñar: en cuanto acaba la entrada, el splash se funde. */
  ready: boolean;
  /** Al terminar el fundido (desmonta el splash). */
  onFinish(): void;
  testID?: string;
}

/**
 * Relevo del splash nativo: el mismo amarillo y la misma Mochi enamorada, en el mismo sitio. Da un
 * saltito (se aplasta, rebota y se balancea) y los ojos de corazón laten una vez; después todo se
 * funde con la app, que ya se ha montado debajo (no espera a la animación para arrancar). Con
 * «reducir movimiento» no se mueve nada: solo el fundido, en cuanto la app está lista.
 */
export function BootSplash({ ready, onFinish, testID = "boot-splash" }: BootSplashProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const palette = useMascotPalette();
  const [introDone, setIntroDone] = useState(reduced);
  const [timedOut, setTimedOut] = useState(false);
  const exiting = useRef(false);
  const finish = useRef(onFinish);
  finish.current = onFinish;

  const hop = useSharedValue(0);
  const tilt = useSharedValue(0);
  const leftBeat = useSharedValue(1);
  const rightBeat = useSharedValue(1);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      setIntroDone(true);
      return;
    }

    // Saltito: se aplasta contra el suelo y rebota (el muelle pasa de largo y estira un poco).
    hop.value = withSequence(withTiming(1, { duration: 110, easing: easings.inOut }), withSpring(0, springs.pop));
    // Balanceo amortiguado sobre su base.
    tilt.value = withDelay(
      110,
      withSequence(
        withTiming(-5, { duration: 150, easing: easings.out }),
        withTiming(3.5, { duration: 170, easing: easings.inOut }),
        withTiming(-1.5, { duration: 150, easing: easings.inOut }),
        withTiming(0, { duration: 130, easing: easings.out })
      )
    );
    // Un latido de los ojos de corazón, la cereza de la derecha un poco después.
    leftBeat.value = withDelay(
      300,
      withSequence(withTiming(1.45, { duration: 120, easing: easings.out }), withSpring(1, springs.pop))
    );
    rightBeat.value = withDelay(
      380,
      withSequence(withTiming(1.45, { duration: 120, easing: easings.out }), withSpring(1, springs.pop))
    );

    const timer = setTimeout(() => setIntroDone(true), BOOT_SPLASH_INTRO_MS);
    return () => clearTimeout(timer);
  }, [hop, leftBeat, reduced, rightBeat, tilt]);

  // Si la app tarda, los corazones siguen latiendo despacio mientras espera (y hay un tope).
  useEffect(() => {
    if (!introDone || ready) {
      return;
    }

    if (!reduced) {
      const beat = () =>
        withRepeat(
          withSequence(
            withDelay(620, withTiming(1.3, { duration: 130, easing: easings.out })),
            withTiming(1, { duration: 260, easing: easings.inOut })
          ),
          -1
        );
      leftBeat.value = beat();
      rightBeat.value = withDelay(80, beat());
    }

    const timer = setTimeout(() => setTimedOut(true), BOOT_SPLASH_MAX_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [introDone, leftBeat, ready, reduced, rightBeat]);

  useEffect(() => {
    if (!introDone || !(ready || timedOut) || exiting.current) {
      return;
    }

    exiting.current = true;
    cancelAnimation(leftBeat);
    cancelAnimation(rightBeat);
    leftBeat.value = withTiming(1, { duration: 120 });
    rightBeat.value = withTiming(1, { duration: 120 });
    const done = () => finish.current();
    exit.value = withTiming(1, { duration: reduced ? 160 : BOOT_SPLASH_EXIT_MS, easing: easings.out }, (finished) => {
      if (finished) {
        runOnJS(done)();
      }
    });
  }, [exit, introDone, leftBeat, ready, reduced, rightBeat, timedOut]);

  const size = BOOT_SPLASH_MASCOT_SIZE;
  const unit = size / MASCOT_CANVAS;
  // La caja se centra en pantalla; se desplaza para que el centro del círculo quede donde lo pone el nativo.
  const shiftX = (MASCOT_CANVAS / 2 - SPLASH_ICON_CENTER.x) * unit;
  const shiftY = (MASCOT_CANVAS / 2 - SPLASH_ICON_CENTER.y) * unit;

  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const bodyStyle = useAnimatedStyle(() => {
    const h = hop.value;
    const grow = 1 + exit.value * 0.06;
    return {
      transform: [
        { translateY: h * 6 },
        { rotate: `${tilt.value}deg` },
        { scaleX: (1 + h * 0.05) * grow },
        { scaleY: (1 - h * 0.08) * grow }
      ]
    };
  });
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ scale: leftBeat.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ scale: rightBeat.value }] }));

  return (
    <Animated.View
      accessibilityLabel="Abriendo Cherry"
      accessibilityRole="progressbar"
      pointerEvents={introDone && (ready || timedOut) ? "none" : "auto"}
      style={[styles.root, { backgroundColor: theme.primitives.color.limonada }, backdropStyle]}
      testID={testID}
    >
      <View style={{ width: size, height: size, transform: [{ translateX: -shiftX }, { translateY: -shiftY }] }}>
        {/* Mochi se apoya en la base de las cerezas (y ≈ 109 de 120): de ahí salta y se balancea. */}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: ["50%", "90%", 0] }, bodyStyle]}>
          <Svg height={size} style={StyleSheet.absoluteFill} viewBox={MASCOT_VIEWBOX} width={size}>
            <MascotBody mood="love" palette={palette} stroke={BRAND_STROKE} withoutLoveEyes />
          </Svg>
          {MASCOT_EYES.map((eye, index) => (
            <Animated.View
              key={`${eye.x}`}
              style={[
                StyleSheet.absoluteFill,
                { transformOrigin: [eye.x * unit, eye.y * unit, 0] },
                index < 2 ? leftStyle : rightStyle
              ]}
            >
              <Svg height={size} viewBox={MASCOT_VIEWBOX} width={size}>
                <MascotLoveEye palette={palette} x={eye.x} y={eye.y} />
              </Svg>
            </Animated.View>
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    elevation: 1000
  }
});
