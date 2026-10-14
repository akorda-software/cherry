import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "../../../shared/ui";
import { HEART } from "../../../shared/ui/art/icon-paths";
import { withAlpha } from "../../../shared/ui/utils/color";

export type DriftKind = "heart" | "cherry";

export interface Drift {
  /** Posición horizontal, en fracción del ancho. */
  x: number;
  size: number;
  kind: DriftKind;
  /** Lo que tarda en subir de abajo arriba (ms): muy despacio. */
  duration: number;
  /** Dónde está al montar la pantalla (0 = abajo, 1 = arriba): así no salen todos a la vez. */
  phase: number;
  /** Vaivén lateral (pt). */
  sway: number;
  /** `light` = blanco; `warm` = el coral de marca, más tenue. */
  tone: "light" | "warm";
  alpha: number;
}

/**
 * Corazones y cerecitas que suben muy despacio por detrás del logo. Pocos, pequeños y tenues; nacen
 * por encima de los botones y se desvanecen antes de llegar arriba, para no ensuciar la zona de toque.
 */
export const LOGIN_DRIFTS: readonly Drift[] = [
  { x: 0.08, size: 18, kind: "heart", duration: 17000, phase: 0.18, sway: 10, tone: "light", alpha: 0.6 },
  { x: 0.2, size: 12, kind: "heart", duration: 21000, phase: 0.62, sway: 6, tone: "warm", alpha: 0.32 },
  { x: 0.33, size: 22, kind: "cherry", duration: 24000, phase: 0.4, sway: 8, tone: "light", alpha: 0.5 },
  { x: 0.5, size: 14, kind: "heart", duration: 19000, phase: 0.9, sway: 7, tone: "light", alpha: 0.55 },
  { x: 0.66, size: 24, kind: "heart", duration: 26000, phase: 0.08, sway: 12, tone: "light", alpha: 0.5 },
  { x: 0.8, size: 18, kind: "cherry", duration: 22000, phase: 0.55, sway: 8, tone: "warm", alpha: 0.3 },
  { x: 0.92, size: 12, kind: "heart", duration: 18000, phase: 0.3, sway: 5, tone: "light", alpha: 0.55 },
  { x: 0.14, size: 16, kind: "cherry", duration: 25000, phase: 0.76, sway: 6, tone: "light", alpha: 0.45 },
  { x: 0.58, size: 11, kind: "heart", duration: 16000, phase: 0.5, sway: 5, tone: "warm", alpha: 0.34 }
];

/** Dónde nace (fracción del alto, desde arriba) y dónde se acaba de desvanecer. */
const DRIFT_FROM = 0.64;
const DRIFT_TO = -0.04;

/** Opacidad a lo largo del recorrido: entra y sale fundiéndose, nunca aparece de golpe. */
export function driftOpacity(progress: number, alpha: number): number {
  "worklet";
  return interpolate(progress, [0, 0.16, 0.78, 1], [0, alpha, alpha, 0]);
}

/** Fondo animado de la bienvenida (decorativo: oculto a los lectores de pantalla). */
export function LoginBackdrop({ drifts = LOGIN_DRIFTS }: { drifts?: readonly Drift[] }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      testID="login-backdrop"
    >
      {drifts.map((drift, index) => (
        <DriftItem drift={drift} height={height} key={index} still={reduced} width={width} />
      ))}
    </View>
  );
}

function DriftItem({ drift, width, height, still }: { drift: Drift; width: number; height: number; still: boolean }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const progress = useSharedValue(drift.phase);

  useEffect(() => {
    if (still) {
      cancelAnimation(progress);
      progress.value = drift.phase;
      return;
    }

    // Termina la vuelta en la que está y después sube una y otra vez a ritmo constante.
    const linear = Easing.linear;
    progress.value = withSequence(
      withTiming(1, { duration: (1 - drift.phase) * drift.duration, easing: linear }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: drift.duration, easing: linear })), -1)
    );
    return () => cancelAnimation(progress);
  }, [drift.duration, drift.phase, progress, still]);

  const style = useDriftStyle(progress, drift, height);
  const color = drift.tone === "light" ? c.white : withAlpha(c.fresa, 0.9);

  return (
    <Animated.View style={[styles.drift, { left: drift.x * width - drift.size / 2, width: drift.size, height: drift.size }, style]}>
      <Svg height={drift.size} viewBox="0 0 24 24" width={drift.size}>
        {drift.kind === "heart" ? (
          <Path d={HEART} fill={color} />
        ) : (
          <>
            <Path d="M7.6 13.5C8.4 8.6 11 5.2 15.2 3.4M15.2 3.4l1.3 10.2" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1.8} />
            <Circle cx={7.4} cy={17.2} fill={color} r={4.8} />
            <Circle cx={16.8} cy={17.6} fill={color} r={4.8} />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}

function useDriftStyle(progress: SharedValue<number>, drift: Drift, height: number) {
  const seed = drift.x * 11;
  return useAnimatedStyle(() => {
    const p = progress.value;
    const wave = Math.sin(p * Math.PI * 3 + seed);
    return {
      opacity: driftOpacity(p, drift.alpha),
      transform: [
        { translateY: interpolate(p, [0, 1], [height * DRIFT_FROM, height * DRIFT_TO]) },
        { translateX: wave * drift.sway },
        { rotate: `${wave * 14}deg` }
      ]
    };
  });
}

const styles = StyleSheet.create({
  drift: {
    position: "absolute",
    top: 0
  }
});
