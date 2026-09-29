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
import type { PastelName, PastelSwatch } from "../tokens/primitives/color";
import { mixHex } from "./color-utils";
import { HEART, SPARKLE } from "./icon-paths";
import { absoluteFill } from "./layout";

export type MascotMood = "happy" | "love" | "wink" | "sleepy" | "surprised" | "sad" | "celebrate" | "thinking";

export const mascotMoods: MascotMood[] = ["happy", "love", "wink", "sleepy", "surprised", "sad", "celebrate", "thinking"];

export interface MascotProps {
  /** Lado del lienzo cuadrado en puntos (def. 120). */
  size?: number;
  mood?: MascotMood;
  /** Pastel del cuerpo (def. fresa). */
  color?: PastelName;
  /** Respira y parpadea; en `celebrate`, da saltitos. Respeta «reducir movimiento». */
  animated?: boolean;
  /** Si se pasa, se anuncia como imagen; si no, es decorativo. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Lienzo de 120 × 120. El cuerpo va de y 34 a 104, apoyado en el suelo. */
const VIEWBOX = "0 0 120 120";
const BODY = "M60 104C84.5 104 102.5 98 102.5 80.5C102.5 55.5 84.5 36.5 60 36.5C35.5 36.5 17.5 55.5 17.5 80.5C17.5 98 35.5 104 60 104Z";
const LEAF_LEFT = "M59 36.5C56 28 50 24 44.5 25.5C46 31.5 51.5 37 59 36.5Z";
const LEAF_RIGHT = "M61 36.5C63.5 27 69.5 22 75.5 22.5C74 29.5 68.5 36 61 36.5Z";
const EYE_Y = 72;
const EYES_X = [43, 77] as const;

interface Palette {
  ink: string;
  white: string;
  body: PastelSwatch;
  cheek: string;
  tongue: string;
  leaf: string;
  heart: string;
  tear: string;
  spark: string;
}

/**
 * Mochi, la mascota: un mochi de fresa con mofletes. Ilustración vectorial de
 * formas exactas; cara de la app en estados vacíos, carga, errores y match.
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
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const p = theme.primitives.pastel;
  const c = theme.primitives.color;
  const body = p[color];

  const palette: Palette = {
    ink: c.ink,
    white: c.white,
    body,
    cheek: color === "fresa" || color === "tomate" ? mixHex(body.fill, c.fresaDeep, 0.26) : mixHex(p.fresa.fill, c.fresaDeep, 0.12),
    tongue: c.tomate,
    leaf: color === "menta" ? p.limonada.fill : p.menta.fill,
    heart: c.fresaDeep,
    tear: p.cielo.fill,
    spark: p.limonada.fill
  };

  // Grosor de línea óptico: ~3.5 en el lienzo, entre 2.25 y 5 px reales.
  const stroke = (Math.min(Math.max((3.5 * size) / 120, 2.25), 5) * 120) / size;
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
      hop.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
    } else {
      hop.value = 0;
      const half = mood === "sleepy" ? 1900 : 1400;
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
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
        withDelay(3600, withTiming(1, { duration: 70, easing: Easing.in(Easing.quad) })),
        withTiming(0, { duration: 110, easing: Easing.out(Easing.quad) })
      ),
      -1,
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
    const scaleX = 1 + 0.022 * b + 0.07 * squash;
    const scaleY = 1 - 0.028 * b - 0.09 * squash;

    return {
      transform: [{ translateY: -lift * size * 0.16 }, { scaleX }, { scaleY }]
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const t = hop.value;
    let lift = 0;
    if (t >= 0.12 && t < 0.46) {
      const u = (t - 0.12) / 0.34;
      lift = 4 * u * (1 - u);
    }
    return { opacity: 1 - 0.45 * lift, transform: [{ scaleX: 1 - 0.3 * lift + 0.03 * breath.value }] };
  });

  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.9 * blink.value }] }));

  const labelled = Boolean(accessibilityLabel);
  const eyeOriginY = `${(eyeCenterY(mood) / 120) * 100}%`;

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size }, style]}
      accessible={labelled ? true : undefined}
      role={labelled ? "img" : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={!labelled}
    >
      <Animated.View style={[absoluteFill, styles.shadowOrigin, shadowStyle]}>
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <Ellipse cx={60} cy={106.5} rx={31} ry={4.5} fill={palette.ink} opacity={0.14} />
        </Svg>
      </Animated.View>

      <Animated.View style={[absoluteFill, styles.bodyOrigin, bodyStyle]}>
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          {behindBody(mood, palette, stroke)}
          <Path d={BODY} fill={palette.body.fill} stroke={palette.ink} strokeWidth={stroke} strokeLinejoin="round" />
          {/* Brillo: arco y punto blancos, arriba a la izquierda. */}
          <Path d="M31 61.5Q33.5 51.5 43.5 45.5" stroke={palette.white} strokeWidth={4.5} strokeLinecap="round" fill="none" opacity={0.9} />
          <Circle cx={50} cy={42.6} r={2.3} fill={palette.white} opacity={0.9} />
          <Sprout mood={mood} palette={palette} stroke={stroke} />
          <Ellipse cx={30.5} cy={82} rx={7.5} ry={4.5} fill={palette.cheek} />
          <Ellipse cx={89.5} cy={82} rx={7.5} ry={4.5} fill={palette.cheek} />
          {face(mood, palette, stroke)}
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

function hasOpenEyes(mood: MascotMood) {
  return mood === "happy" || mood === "wink" || mood === "surprised" || mood === "sad" || mood === "thinking";
}

function eyeCenterY(mood: MascotMood) {
  return mood === "thinking" ? EYE_Y - 2 : EYE_Y;
}

function Sprout({ mood, palette, stroke }: { mood: MascotMood; palette: Palette; stroke: number }) {
  const droop = mood === "sad" ? 32 : mood === "sleepy" ? 14 : 0;
  const perk = mood === "celebrate" || mood === "surprised" ? -10 : 0;
  const tilt = droop + perk;

  return (
    <G>
      <Path
        d={LEAF_LEFT}
        transform={`rotate(${-tilt} 59 36.5)`}
        fill={palette.leaf}
        stroke={palette.ink}
        strokeWidth={stroke * 0.8}
        strokeLinejoin="round"
      />
      <Path
        d={LEAF_RIGHT}
        transform={`rotate(${tilt} 61 36.5)`}
        fill={palette.leaf}
        stroke={palette.ink}
        strokeWidth={stroke * 0.8}
        strokeLinejoin="round"
      />
    </G>
  );
}

/** Ojos abiertos (capa que parpadea). */
function openEyes(mood: MascotMood, pal: Palette): ReactNode {
  const dot = (cx: number, cy: number, r: number, key: string, shine = 1) => (
    <G key={key}>
      <Circle cx={cx} cy={cy} r={r} fill={pal.ink} />
      <Circle cx={cx + r * 0.36} cy={cy - r * 0.4} r={r * 0.36 * shine} fill={pal.white} />
      {shine > 1 ? <Circle cx={cx - r * 0.38} cy={cy + r * 0.42} r={r * 0.17} fill={pal.white} /> : null}
    </G>
  );

  switch (mood) {
    case "happy":
      return [dot(EYES_X[0], EYE_Y, 5.4, "l"), dot(EYES_X[1], EYE_Y, 5.4, "r")];
    case "wink":
      return [dot(EYES_X[0], EYE_Y, 5.4, "l")];
    case "surprised":
      return [dot(EYES_X[0], EYE_Y, 6.6, "l", 1.15), dot(EYES_X[1], EYE_Y, 6.6, "r", 1.15)];
    case "sad":
      return [dot(EYES_X[0], EYE_Y, 5.8, "l", 1.25), dot(EYES_X[1], EYE_Y, 5.8, "r", 1.25)];
    case "thinking":
      return [dot(EYES_X[0] + 2.5, EYE_Y - 2, 5.2, "l"), dot(EYES_X[1] + 2.5, EYE_Y - 2, 5.2, "r")];
    default:
      return null;
  }
}

/** Resto de la cara: ojos cerrados o de corazón, boca, cejas, lágrima. */
function face(mood: MascotMood, pal: Palette, stroke: number): ReactNode {
  const line = { stroke: pal.ink, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const openSmile = (w: number, depth: number) => {
    const x0 = 60 - w / 2;
    const x1 = 60 + w / 2;
    const top = 79.5;
    return (
      <G key="mouth">
        <Path
          d={`M${x0} ${top}C${x0 + 1} ${top + depth} ${x1 - 1} ${top + depth} ${x1} ${top}Z`}
          fill={pal.ink}
          stroke={pal.ink}
          strokeWidth={stroke * 0.7}
          strokeLinejoin="round"
        />
        <Path
          d={`M${60 - w * 0.24} ${top + depth * 0.66}C${60 - w * 0.1} ${top + depth * 0.46} ${60 + w * 0.1} ${top + depth * 0.46} ${60 + w * 0.24} ${top + depth * 0.66}C${60 + w * 0.1} ${top + depth * 0.8} ${60 - w * 0.1} ${top + depth * 0.8} ${60 - w * 0.24} ${top + depth * 0.66}Z`}
          fill={pal.tongue}
        />
      </G>
    );
  };
  const happyClosed = (cx: number, key: string) => (
    <Path key={key} d={`M${cx - 6.5} ${EYE_Y + 1.5}Q${cx} ${EYE_Y - 6} ${cx + 6.5} ${EYE_Y + 1.5}`} {...line} />
  );

  switch (mood) {
    case "happy":
      return openSmile(13, 8.5);
    case "love":
      return [
        ...EYES_X.map((cx) => (
          <G key={`h${cx}`}>
            <Path
              d={HEART}
              transform={`translate(${cx - 12 * 0.78} ${EYE_Y - 12 * 0.78}) scale(0.78)`}
              fill={pal.heart}
              stroke={pal.ink}
              strokeWidth={(stroke * 0.8) / 0.78}
              strokeLinejoin="round"
            />
            <Circle cx={cx + 2.6} cy={EYE_Y - 3.2} r={1.5} fill={pal.white} />
          </G>
        )),
        openSmile(15, 10)
      ];
    case "wink":
      return [happyClosed(EYES_X[1], "wink"), openSmile(13, 8.5)];
    case "sleepy":
      return [
        ...EYES_X.map((cx) => <Path key={`s${cx}`} d={`M${cx - 6.5} ${EYE_Y - 1}Q${cx} ${EYE_Y + 4.5} ${cx + 6.5} ${EYE_Y - 1}`} {...line} />),
        <Ellipse key="mouth" cx={60} cy={83} rx={2.6} ry={3} fill={pal.ink} />
      ];
    case "surprised":
      return [
        <Path key="bl" d="M36 60.5Q43 55.5 50 59.5" {...line} />,
        <Path key="br" d="M84 60.5Q77 55.5 70 59.5" {...line} />,
        <Ellipse key="mouth" cx={60} cy={84} rx={4.2} ry={5} fill={pal.ink} />
      ];
    case "sad":
      return [
        <Path key="bl" d="M35.5 63.5Q41 59.5 48.5 60" {...line} />,
        <Path key="br" d="M84.5 63.5Q79 59.5 71.5 60" {...line} />,
        <Path key="mouth" d="M54.5 85Q60 80 65.5 85" {...line} />,
        <Path
          key="tear"
          d="M35.5 78.5C33.6 81.2 32.3 83.4 32.3 85a3.2 3.2 0 0 0 6.4 0c0-1.6-1.3-3.8-3.2-6.5Z"
          fill={pal.tear}
          stroke={pal.ink}
          strokeWidth={stroke * 0.7}
          strokeLinejoin="round"
        />
      ];
    case "celebrate":
      return [happyClosed(EYES_X[0], "l"), happyClosed(EYES_X[1], "r"), openSmile(17, 11.5)];
    case "thinking":
      return <Path d="M54.5 83Q57.5 80.5 60.5 83T66.5 82.5" {...line} />;
  }
}

/** Bracitos que asoman por detrás del cuerpo. */
function behindBody(mood: MascotMood, pal: Palette, stroke: number): ReactNode {
  if (mood !== "celebrate") {
    return null;
  }

  const arm = (d: string, key: string) => (
    <G key={key}>
      <Path d={d} stroke={pal.ink} strokeWidth={12 + stroke * 2} strokeLinecap="round" fill="none" />
      <Path d={d} stroke={pal.body.fill} strokeWidth={12} strokeLinecap="round" fill="none" />
    </G>
  );

  return [arm("M24.5 75L12.5 58.5", "al"), arm("M95.5 75L107.5 58.5", "ar")];
}

/** Adornos alrededor (no se estiran con la respiración). */
function extras(mood: MascotMood, pal: Palette, stroke: number): ReactNode {
  const line = { stroke: pal.ink, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const sparkle = (x: number, y: number, s: number, key: string) => (
    <Path
      key={key}
      d={SPARKLE}
      transform={`translate(${x - 12 * s} ${y - 12 * s}) scale(${s})`}
      fill={pal.spark}
      stroke={pal.ink}
      strokeWidth={(stroke * 0.75) / s}
      strokeLinejoin="round"
    />
  );

  switch (mood) {
    case "sleepy":
      return [
        <Path key="z1" d="M89 30.5h9l-9 10h9" {...line} />,
        <Path key="z2" d="M103.5 14.5h6.5l-6.5 7.5h6.5" {...line} strokeWidth={stroke * 0.85} />
      ];
    case "surprised":
      return [
        <Path key="s1" d="M20.5 40.5l-6-4.5" {...line} />,
        <Path key="s2" d="M26.5 33l-3.5-6.5" {...line} />,
        <Path key="s3" d="M99.5 40.5l6-4.5" {...line} />,
        <Path key="s4" d="M93.5 33l3.5-6.5" {...line} />
      ];
    case "celebrate":
      return [sparkle(15, 33, 0.6, "a"), sparkle(104, 25, 0.5, "b")];
    case "love":
      return (
        <Path
          d={HEART}
          transform="translate(88 12) scale(0.72) rotate(12 12 12)"
          fill={pal.body.fill}
          stroke={pal.ink}
          strokeWidth={(stroke * 0.8) / 0.72}
          strokeLinejoin="round"
        />
      );
    case "thinking":
      return [
        <Circle key="t1" cx={95} cy={43} r={2.4} {...line} fill={pal.white} strokeWidth={stroke * 0.7} />,
        <Circle key="t2" cx={102} cy={33} r={3.6} {...line} fill={pal.white} strokeWidth={stroke * 0.75} />,
        <Circle key="t3" cx={110} cy={19} r={5.4} {...line} fill={pal.white} strokeWidth={stroke * 0.8} />
      ];
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  bodyOrigin: { transformOrigin: "50% 87%" },
  shadowOrigin: { transformOrigin: "50% 89%" }
});
