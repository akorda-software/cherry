import { memo, type ReactNode, useEffect } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { mixHex } from "./color-utils";
import { HEART } from "./icon-paths";
import { absoluteFill } from "./layout";

export type MascotMood = "happy" | "love" | "wink" | "sleepy" | "surprised" | "sad" | "celebrate" | "thinking";

export const mascotMoods: MascotMood[] = ["happy", "love", "wink", "sleepy", "surprised", "sad", "celebrate", "thinking"];

export interface MascotProps {
  /** Lado del lienzo cuadrado en puntos (def. 120). */
  size?: number;
  mood?: MascotMood;
  /** Pastel de la hoja (def. fresa, que pinta la hoja en menta). Las cerezas son siempre cereza. */
  color?: PastelName;
  /** Al aparecer respira y parpadea un par de veces (en `celebrate`, tres saltitos) y se queda quieta. Respeta «reducir movimiento». */
  animated?: boolean;
  /** Si se pasa, se anuncia como imagen; si no, es decorativo. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Lienzo de 120 × 120. Dos cerezas de un mismo rabito, apoyadas en y 104. */
const VIEWBOX = "0 0 120 120";
export const MASCOT_VIEWBOX = VIEWBOX;
export const MASCOT_CANVAS = 120;
const SHADOW = 5;
const CHERRY_R = 22;
const LEFT = { cx: 40, cy: 82, eyes: [33, 47] as const, eyeY: 80, mouthX: 41, mouthY: 91 };
const RIGHT = { cx: 82, cy: 78, eyes: [76, 89] as const, eyeY: 76, mouthX: 83, mouthY: 87 };
const CHERRIES = [LEFT, RIGHT] as const;
const STEM_LEFT = "M42 61Q46 34 70 18";
const STEM_RIGHT = "M81 57Q77 36 70 18";
const LEAF = "M70 18Q84 8 99 16Q88 28 70 18Z";
/** Altura media de los ojos: eje del parpadeo. */
const EYES_Y = (LEFT.eyeY + RIGHT.eyeY) / 2;

export interface MascotPalette {
  ink: string;
  white: string;
  cherry: string;
  leaf: string;
}

type Palette = MascotPalette;

/** Colores de Mochi: contorno de tinta, cerezas cereza y la hoja del pastel elegido (fresa → menta). */
export function useMascotPalette(color: PastelName = "fresa"): MascotPalette {
  const theme = useTheme();
  const p = theme.primitives.pastel;
  const c = theme.primitives.color;

  return {
    ink: c.ink,
    white: c.white,
    cherry: mixHex(p.fresa.fill, c.tomateDeep, 0.4),
    leaf: color === "fresa" || color === "tomate" ? p.menta.fill : p[color].fill
  };
}

/** Grosor de línea en unidades del lienzo: ~3.5, entre 2.25 y 5 px reales según el tamaño. */
export function mascotStroke(size: number): number {
  return (Math.min(Math.max((3.5 * size) / 120, 2.25), 5) * 120) / size;
}

/** Centros de los cuatro ojos (en `love`, los corazones), en unidades del lienzo. */
export const MASCOT_EYES: readonly { x: number; y: number }[] = CHERRIES.flatMap(({ eyes, eyeY }) =>
  eyes.map((x) => ({ x, y: eyeY }))
);

/**
 * La mascota (provisional): dos cerezas del mismo rabito. Ilustración vectorial plana
 * con contorno y sombra dura de tinta; cara de la app en vacíos, carga, errores y match, y
 * (con `love`) el logo de la app.
 */
export const Mascot = memo(function Mascot({
  size = 120,
  mood = "happy",
  color = "fresa",
  animated = true,
  accessibilityLabel,
  style,
  testID
}: MascotProps) {
  const reducedMotion = useReducedMotion();
  const palette = useMascotPalette(color);
  const stroke = mascotStroke(size);
  const motion = animated && !reducedMotion;

  const breath = useSharedValue(0);
  const hop = useSharedValue(0);
  const blink = useSharedValue(0);

  useEffect(() => {
    if (!motion) {
      cancelAnimation(breath);
      cancelAnimation(hop);
      breath.value = 0;
      hop.value = 0;
      return;
    }

    if (mood === "celebrate") {
      breath.value = 0;
      hop.value = 0;
      hop.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), 3, false);
    } else {
      hop.value = 0;
      const half = mood === "sleepy" ? 1900 : 1400;
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) })
        ),
        2,
        false
      );
    }

    return () => {
      cancelAnimation(breath);
      cancelAnimation(hop);
    };
  }, [breath, hop, mood, motion]);

  const blinks = animated && hasOpenEyes(mood);

  useEffect(() => {
    if (!blinks) {
      cancelAnimation(blink);
      blink.value = 0;
      return;
    }

    blink.value = withRepeat(
      withSequence(
        withDelay(1800, withTiming(1, { duration: 70, easing: Easing.in(Easing.quad) })),
        withTiming(0, { duration: 110, easing: Easing.out(Easing.quad) })
      ),
      2,
      false
    );

    return () => cancelAnimation(blink);
  }, [blink, blinks]);

  const bodyStyle = useAnimatedStyle(() => {
    const t = hop.value;
    let lift = 0;
    let squash = 0;

    if (t > 0) {
      if (t < 0.12) {
        squash = Math.sin((t / 0.12) * Math.PI) * 0.7; // anticipación
      } else if (t < 0.46) {
        const u = (t - 0.12) / 0.34;
        lift = 4 * u * (1 - u);
        squash = -0.5 * (1 - lift); // se estira al despegar y al caer
      } else if (t < 0.6) {
        squash = Math.sin(((t - 0.46) / 0.14) * Math.PI); // aterrizaje
      }
    }

    const b = breath.value;
    const scaleX = 1 + 0.018 * b + 0.06 * squash;
    const scaleY = 1 - 0.022 * b - 0.08 * squash;

    return {
      transform: [{ translateY: -lift * size * 0.14 }, { scaleX }, { scaleY }]
    };
  });

  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.9 * blink.value }] }));

  const labelled = Boolean(accessibilityLabel);
  const eyeOriginY = `${(EYES_Y / 120) * 100}%`;

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size }, style]}
      accessible={labelled ? true : undefined}
      role={labelled ? "img" : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={!labelled}
    >
      <Animated.View style={[absoluteFill, styles.bodyOrigin, bodyStyle]}>
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <MascotBody mood={mood} palette={palette} stroke={stroke} />
        </Svg>

        <Animated.View style={[absoluteFill, { transformOrigin: `50% ${eyeOriginY}` }, eyeStyle]}>
          <Svg width={size} height={size} viewBox={VIEWBOX}>
            {openEyes(mood, palette)}
          </Svg>
        </Animated.View>
      </Animated.View>

      <View style={absoluteFill}>
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          {extras(mood, palette, stroke)}
        </Svg>
      </View>
    </View>
  );
});

interface MascotBodyProps {
  mood: MascotMood;
  palette: MascotPalette;
  stroke: number;
  /** En `love`, sin los corazones de los ojos (para animarlos aparte con `MascotLoveEye`). */
  withoutLoveEyes?: boolean;
}

/**
 * Cuerpo de Mochi para meter en un `<Svg viewBox={MASCOT_VIEWBOX}>`: rabitos, hoja, cerezas con su
 * sombra dura y la cara (sin los ojos abiertos, que van en su capa para parpadear).
 */
export function MascotBody({ mood, palette, stroke, withoutLoveEyes = false }: MascotBodyProps) {
  return (
    <>
      <Stem mood={mood} palette={palette} stroke={stroke} />
      {CHERRIES.map(({ cx, cy }) => (
        <G key={cx}>
          <Circle cx={cx + SHADOW} cy={cy + SHADOW} r={CHERRY_R} fill={palette.ink} />
          <Circle cx={cx} cy={cy} r={CHERRY_R} fill={palette.cherry} stroke={palette.ink} strokeWidth={stroke} />
        </G>
      ))}
      {face(mood, palette, stroke, !withoutLoveEyes)}
    </>
  );
}

/** Un ojo de corazón de `love`, centrado en `x`, `y` (ver `MASCOT_EYES`). */
export function MascotLoveEye({ x, y, palette }: { x: number; y: number; palette: MascotPalette }) {
  return <Path d={HEART} transform={`translate(${x - 12 * 0.5} ${y - 12 * 0.5}) scale(0.5)`} fill={palette.ink} />;
}

function hasOpenEyes(mood: MascotMood) {
  return mood === "happy" || mood === "wink" || mood === "surprised" || mood === "sad" || mood === "thinking";
}

/** Rabitos y hoja; la hoja cae con la pena y se estira con la sorpresa. */
function Stem({ mood, palette, stroke }: { mood: MascotMood; palette: Palette; stroke: number }) {
  const tilt = mood === "sad" ? 34 : mood === "sleepy" ? 16 : mood === "celebrate" || mood === "surprised" ? -10 : 0;
  const line = { stroke: palette.ink, strokeWidth: stroke, strokeLinecap: "round" as const, fill: "none" };

  return (
    <G>
      <Path d={STEM_LEFT} {...line} />
      <Path d={STEM_RIGHT} {...line} />
      <Path
        d={LEAF}
        transform={`rotate(${tilt} 70 18)`}
        fill={palette.leaf}
        stroke={palette.ink}
        strokeWidth={stroke * 0.9}
        strokeLinejoin="round"
      />
    </G>
  );
}

/** Ojos abiertos (capa que parpadea). */
function openEyes(mood: MascotMood, pal: Palette): ReactNode {
  const pair = (r: number, dx = 0, dy = 0) =>
    CHERRIES.flatMap(({ eyes, eyeY }) =>
      eyes.map((x) => <Circle key={`${x}`} cx={x + dx} cy={eyeY + dy} r={r} fill={pal.ink} />)
    );

  switch (mood) {
    case "happy":
      return pair(2.9);
    case "wink":
      return [
        ...LEFT.eyes.map((x) => <Circle key={`l${x}`} cx={x} cy={LEFT.eyeY} r={2.9} fill={pal.ink} />),
        <Circle key="r" cx={RIGHT.eyes[0]} cy={RIGHT.eyeY} r={2.9} fill={pal.ink} />
      ];
    case "surprised":
      return pair(3.7);
    case "sad":
      return pair(2.8, 0, 1);
    case "thinking":
      return pair(2.7, -1.2, -1.6);
    default:
      return null;
  }
}

/** Resto de la cara: ojos cerrados o de corazón y bocas. */
function face(mood: MascotMood, pal: Palette, stroke: number, loveEyes = true): ReactNode {
  const w = stroke * 0.85;
  const line = { stroke: pal.ink, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const mouths = (shape: (x: number, y: number) => string, filled = false) =>
    CHERRIES.map(({ mouthX, mouthY }) =>
      filled ? (
        <Path key={`m${mouthX}`} d={shape(mouthX, mouthY)} fill={pal.ink} stroke={pal.ink} strokeWidth={w * 0.6} strokeLinejoin="round" />
      ) : (
        <Path key={`m${mouthX}`} d={shape(mouthX, mouthY)} {...line} />
      )
    );
  const eyes = (shape: (x: number, y: number) => string) =>
    CHERRIES.flatMap(({ eyes: xs, eyeY }) => xs.map((x) => <Path key={`e${x}`} d={shape(x, eyeY)} {...line} />));
  const smile = (x: number, y: number) => `M${x - 5} ${y}Q${x} ${y + 3.5} ${x + 5} ${y}`;

  switch (mood) {
    case "happy":
    case "wink":
      return [
        ...mouths(smile),
        ...(mood === "wink"
          ? [<Path key="wink" d={`M${RIGHT.eyes[1] - 3.5} ${RIGHT.eyeY + 1}Q${RIGHT.eyes[1]} ${RIGHT.eyeY - 2.5} ${RIGHT.eyes[1] + 3.5} ${RIGHT.eyeY + 1}`} {...line} />]
          : [])
      ];
    case "love":
      return [
        ...(loveEyes
          ? CHERRIES.flatMap(({ eyes: xs, eyeY }) => xs.map((x) => <MascotLoveEye key={`h${x}`} palette={pal} x={x} y={eyeY} />))
          : []),
        ...mouths((x, y) => `M${x - 5} ${y}Q${x} ${y + 4} ${x + 5} ${y - 0.5}`)
      ];
    case "sleepy":
      return [...eyes((x, y) => `M${x - 3.5} ${y - 0.5}Q${x} ${y + 2.8} ${x + 3.5} ${y - 0.5}`), ...mouths((x, y) => `M${x - 2.5} ${y + 0.5}H${x + 2.5}`)];
    case "surprised":
      return CHERRIES.map(({ mouthX, mouthY }) => <Ellipse key={`o${mouthX}`} cx={mouthX} cy={mouthY + 1} rx={2.4} ry={3} fill={pal.ink} />);
    case "sad":
      return mouths((x, y) => `M${x - 4.5} ${y + 2}Q${x} ${y - 1.5} ${x + 4.5} ${y + 2}`);
    case "celebrate":
      return [
        ...eyes((x, y) => `M${x - 3.5} ${y + 1}Q${x} ${y - 2.8} ${x + 3.5} ${y + 1}`),
        ...mouths((x, y) => `M${x - 5.5} ${y - 1}Q${x} ${y + 7} ${x + 5.5} ${y - 1}Z`, true)
      ];
    case "thinking":
      return mouths((x, y) => `M${x - 3.5} ${y + 0.5}H${x + 3.5}`);
  }
}

/** Adornos alrededor (no se estiran con la respiración). Sobrios: solo donde aportan. */
function extras(mood: MascotMood, pal: Palette, stroke: number): ReactNode {
  const line = { stroke: pal.ink, strokeWidth: stroke * 0.85, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  switch (mood) {
    case "sleepy":
      return [<Path key="z1" d="M14 34h8l-8 9h8" {...line} />, <Path key="z2" d="M27 20h6l-6 7h6" {...line} />];
    case "surprised":
      return [<Path key="s1" d="M13 62l-6-3" {...line} />, <Path key="s2" d="M12 72H5" {...line} />];
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  bodyOrigin: { transformOrigin: "50% 87%" }
});
