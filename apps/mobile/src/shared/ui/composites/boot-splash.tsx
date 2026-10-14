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

import { CherryMarkShapes, cherryMarkWidth, useCherryMarkColors } from "../art/cherry-mark";
import {
  CHERRY_MARK_HEIGHT,
  CHERRY_MARK_OPTICAL_CENTER,
  CHERRY_MARK_PIVOTS,
  CHERRY_MARK_VIEWBOX,
  CHERRY_MARK_WIDTH
} from "../art/cherry-mark-geometry";
import { easings, springs } from "../motion/springs";
import { useTheme } from "../providers/theme-provider";

/**
 * Ancho del logo en el splash nativo (`imageWidth` de expo-splash-screen en app.config.ts) y escala
 * del dibujo dentro de `splash-icon.png` (1024 px). Con ellos, el logo de JS cae justo encima del
 * nativo y el relevo no se nota.
 */
export const SPLASH_IMAGE_WIDTH = 200;
const SPLASH_ICON_MARK_SCALE = 478 / 409;
export const BOOT_SPLASH_MARK_HEIGHT = (CHERRY_MARK_HEIGHT * SPLASH_ICON_MARK_SCALE * SPLASH_IMAGE_WIDTH) / 1024;

/** Lo que dura la entrada: rebote, balanceo de las cerezas y latido de las hojas. */
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
 * Relevo del splash nativo: el mismo amarillo y el mismo logo, en el mismo sitio. Las cerezas dan un
 * saltito, se balancean colgadas del rabito y las hojas-corazón laten una vez; después todo se funde
 * con la app, que ya se ha montado debajo (no espera a la animación para arrancar). Con «reducir
 * movimiento» no se mueve nada: solo el fundido, en cuanto la app está lista.
 */
export function BootSplash({ ready, onFinish, testID = "boot-splash" }: BootSplashProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const colors = useCherryMarkColors("color");
  const [introDone, setIntroDone] = useState(reduced);
  const [timedOut, setTimedOut] = useState(false);
  const exiting = useRef(false);
  const finish = useRef(onFinish);
  finish.current = onFinish;

  const hop = useSharedValue(0);
  const swing = useSharedValue(0);
  const bigBeat = useSharedValue(1);
  const smallBeat = useSharedValue(1);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      setIntroDone(true);
      return;
    }

    // Saltito: se aplasta contra el suelo y rebota (el muelle pasa de largo y estira un poco).
    hop.value = withSequence(withTiming(1, { duration: 110, easing: easings.inOut }), withSpring(0, springs.pop));
    // Balanceo amortiguado de las cerezas, colgadas de la unión de los rabitos.
    swing.value = withDelay(
      110,
      withSequence(
        withTiming(6, { duration: 150, easing: easings.out }),
        withTiming(-4, { duration: 170, easing: easings.inOut }),
        withTiming(2, { duration: 150, easing: easings.inOut }),
        withTiming(0, { duration: 130, easing: easings.out })
      )
    );
    // Un latido por hoja, la pequeña un poco después.
    bigBeat.value = withDelay(
      300,
      withSequence(withTiming(1.2, { duration: 120, easing: easings.out }), withSpring(1, springs.pop))
    );
    smallBeat.value = withDelay(
      380,
      withSequence(withTiming(1.24, { duration: 120, easing: easings.out }), withSpring(1, springs.pop))
    );

    const timer = setTimeout(() => setIntroDone(true), BOOT_SPLASH_INTRO_MS);
    return () => clearTimeout(timer);
  }, [bigBeat, hop, reduced, smallBeat, swing]);

  // Si la app tarda, las hojas siguen latiendo despacio mientras espera (y hay un tope).
  useEffect(() => {
    if (!introDone || ready) {
      return;
    }

    if (!reduced) {
      const beat = (peak: number) =>
        withRepeat(
          withSequence(
            withDelay(620, withTiming(peak, { duration: 130, easing: easings.out })),
            withTiming(1, { duration: 260, easing: easings.inOut })
          ),
          -1
        );
      bigBeat.value = beat(1.14);
      smallBeat.value = withDelay(80, beat(1.16));
    }

    const timer = setTimeout(() => setTimedOut(true), BOOT_SPLASH_MAX_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [bigBeat, introDone, ready, reduced, smallBeat]);

  useEffect(() => {
    if (!introDone || !(ready || timedOut) || exiting.current) {
      return;
    }

    exiting.current = true;
    cancelAnimation(bigBeat);
    cancelAnimation(smallBeat);
    bigBeat.value = withTiming(1, { duration: 120 });
    smallBeat.value = withTiming(1, { duration: 120 });
    const done = () => finish.current();
    exit.value = withTiming(1, { duration: reduced ? 160 : BOOT_SPLASH_EXIT_MS, easing: easings.out }, (finished) => {
      if (finished) {
        runOnJS(done)();
      }
    });
  }, [bigBeat, exit, introDone, ready, reduced, smallBeat, timedOut]);

  const height = BOOT_SPLASH_MARK_HEIGHT;
  const width = cherryMarkWidth(height);
  const unit = height / CHERRY_MARK_HEIGHT;
  // La caja se centra en pantalla; se desplaza para que el centro óptico quede donde lo pone el nativo.
  const shiftX = (CHERRY_MARK_WIDTH / 2 - CHERRY_MARK_OPTICAL_CENTER.x) * unit;
  const shiftY = (CHERRY_MARK_HEIGHT / 2 - CHERRY_MARK_OPTICAL_CENTER.y) * unit;
  const origin = (point: { x: number; y: number }) => ({
    transformOrigin: [point.x * unit, point.y * unit, 0] as [number, number, number]
  });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const markStyle = useAnimatedStyle(() => {
    const h = hop.value;
    const grow = 1 + exit.value * 0.06;
    return {
      transform: [{ translateY: h * 6 }, { scaleX: (1 + h * 0.04) * grow }, { scaleY: (1 - h * 0.07) * grow }]
    };
  });
  const swingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));
  const bigStyle = useAnimatedStyle(() => ({ transform: [{ scale: bigBeat.value }] }));
  const smallStyle = useAnimatedStyle(() => ({ transform: [{ scale: smallBeat.value }] }));

  const layer = (parts: Parameters<typeof CherryMarkShapes>[0]["parts"]) => (
    <Svg height={height} style={StyleSheet.absoluteFill} viewBox={CHERRY_MARK_VIEWBOX} width={width}>
      <CherryMarkShapes colors={colors} parts={parts} />
    </Svg>
  );

  return (
    <Animated.View
      accessibilityLabel="Abriendo Cherry"
      accessibilityRole="progressbar"
      pointerEvents={introDone && (ready || timedOut) ? "none" : "auto"}
      style={[styles.root, { backgroundColor: theme.primitives.color.limonada }, backdropStyle]}
      testID={testID}
    >
      <View style={{ width, height, transform: [{ translateX: -shiftX }, { translateY: -shiftY }] }}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: ["50%", "100%", 0] }, markStyle]}>
          {layer(["stalk"])}
          <Animated.View style={[StyleSheet.absoluteFill, origin(CHERRY_MARK_PIVOTS.junction), swingStyle]}>
            {layer(["cherries"])}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, origin(CHERRY_MARK_PIVOTS.bigTip), bigStyle]}>
            {layer(["bigHeart"])}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, origin(CHERRY_MARK_PIVOTS.smallTip), smallStyle]}>
            {layer(["smallHeart"])}
          </Animated.View>
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
