import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
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
import Svg, { Circle, Rect } from "react-native-svg";

import { Text, useTheme } from "../../../shared/ui";

const W = 280;
const H = 236;
const PHONE = { x: 85, y: 6, w: 110, h: 222 };
const CARD = { w: 150, h: 96 };
/** Dónde acaba la tarjeta: detrás del móvil, centrada y en la parte de arriba (la de la cámara). */
const TARGET = { x: PHONE.x + PHONE.w / 2 - CARD.w / 2, y: 30 };
/** Desde dónde llega: abajo a la derecha, casi fuera del móvil. */
const FROM = { x: 150, y: 128 };

export type NfcPlacementMode = "guide" | "reading";

/**
 * Cómo colocar el documento: el móvil se ve por delante (con su pantalla) y la tarjeta entra
 * POR DETRÁS hasta la parte de arriba, la de la cámara. Asoma por los lados y, a través del
 * móvil, se ve su contorno discontinuo. Con la tarjeta colocada laten ondas de NFC. `guide` lo
 * repite en bucle; en `reading` la tarjeta ya está colocada. Con «reducir movimiento», imagen
 * fija. Geométrico, sin ningún dato real.
 */
export function NfcPlacementArt({ mode = "guide" }: { mode?: NfcPlacementMode }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const ink = theme.primitives.color.ink;
  const white = theme.primitives.color.white;
  const card = theme.primitives.pastel.cielo;
  const chip = theme.primitives.pastel.limonada;
  const screen = theme.primitives.pastel.menta;
  const accent = theme.primitives.pastel.fresa;

  // 0 = fuera, 1 = colocada.
  const place = useSharedValue(mode === "reading" || reducedMotion ? 1 : 0);
  const wave = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      place.value = 1;
      wave.value = 0;
      return;
    }

    if (mode === "reading") {
      place.value = withTiming(1, { duration: 300 });
    } else {
      place.value = 0;
      place.value = withRepeat(
        withSequence(
          withDelay(400, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) })),
          withDelay(2400, withTiming(0, { duration: 0 }))
        ),
        -1
      );
    }

    wave.value = 0;
    wave.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1);

    return () => {
      cancelAnimation(place);
      cancelAnimation(wave);
    };
  }, [mode, place, reducedMotion, wave]);

  const cardStyle = useAnimatedStyle(() => cardFrame(place.value));
  // El contorno «a rayos X» solo cuando la tarjeta ya está casi detrás.
  const outlineStyle = useAnimatedStyle(() => ({
    ...cardFrame(place.value),
    opacity: Math.max(0, (place.value - 0.4) / 0.6)
  }));
  const waveA = useAnimatedStyle(() => waveFrame(wave.value, place.value));
  const waveB = useAnimatedStyle(() => waveFrame((wave.value + 0.5) % 1, place.value));

  return (
    <View
      accessibilityLabel="Dibujo de un DNI que se coloca detrás del móvil, en la parte de arriba, donde está la cámara"
      accessible
      style={styles.wrap}
      testID="nfc-placement-art"
    >
      <View style={styles.canvas}>
        {/* 1. Tarjeta, por debajo del móvil */}
        <Animated.View pointerEvents="none" style={[styles.layer, cardStyle]}>
          <Svg height={CARD.h + 5} viewBox={`0 0 ${CARD.w + 5} ${CARD.h + 5}`} width={CARD.w + 5}>
            <Rect fill={ink} height={CARD.h} rx={10} width={CARD.w} x={4} y={4} />
            <Rect fill={card.soft} height={CARD.h} rx={10} stroke={ink} strokeWidth={2.5} width={CARD.w} x={1} y={1} />
            <Rect fill={white} height={46} rx={6} stroke={ink} strokeWidth={2} width={34} x={12} y={24} />
            <Rect fill={chip.fill} height={20} rx={4} stroke={ink} strokeWidth={2} width={26} x={110} y={14} />
            {[30, 44, 58].map((y, index) => (
              <Rect fill={ink} height={6} key={y} opacity={0.16} rx={3} width={index === 1 ? 44 : 62} x={56} y={y} />
            ))}
          </Svg>
        </Animated.View>

        {/* 2. Móvil visto por delante, con la pantalla encendida */}
        <Svg height={H} pointerEvents="none" style={styles.layer} viewBox={`0 0 ${W} ${H}`} width={W}>
          <Rect fill={ink} height={PHONE.h} rx={22} width={PHONE.w} x={PHONE.x + 5} y={PHONE.y + 5} />
          <Rect fill={white} height={PHONE.h} rx={22} stroke={ink} strokeWidth={3} width={PHONE.w} x={PHONE.x} y={PHONE.y} />
          <Rect fill={screen.soft} height={PHONE.h - 20} rx={15} width={PHONE.w - 18} x={PHONE.x + 9} y={PHONE.y + 10} />
          {/* Cámara frontal */}
          <Rect fill={ink} height={9} rx={4.5} width={30} x={PHONE.x + PHONE.w / 2 - 15} y={PHONE.y + 17} />
          {/* La app: un escudo y unas líneas */}
          <Circle cx={PHONE.x + PHONE.w / 2} cy={PHONE.y + 150} fill={screen.fill} r={18} stroke={ink} strokeWidth={2} />
          <Rect fill={ink} height={6} opacity={0.2} rx={3} width={60} x={PHONE.x + PHONE.w / 2 - 30} y={PHONE.y + 180} />
          <Rect fill={ink} height={6} opacity={0.14} rx={3} width={42} x={PHONE.x + PHONE.w / 2 - 21} y={PHONE.y + 192} />
        </Svg>

        {/* 3. Contorno de la tarjeta a través del móvil */}
        <Animated.View pointerEvents="none" style={[styles.layer, outlineStyle]}>
          <Svg height={CARD.h + 5} viewBox={`0 0 ${CARD.w + 5} ${CARD.h + 5}`} width={CARD.w + 5}>
            <Rect
              fill="none"
              height={CARD.h}
              opacity={0.55}
              rx={10}
              stroke={ink}
              strokeDasharray="7 6"
              strokeWidth={2.5}
              width={CARD.w}
              x={1}
              y={1}
            />
          </Svg>
        </Animated.View>

        {/* 4. Ondas del NFC */}
        <Animated.View pointerEvents="none" style={[styles.wave, { borderColor: accent.fill }, waveA]} />
        <Animated.View pointerEvents="none" style={[styles.wave, { borderColor: accent.fill }, waveB]} />
      </View>

      <Text align="center" color="muted" variant="caption">
        El DNI va detrás del móvil, en la parte de la cámara
      </Text>
    </View>
  );
}

function cardFrame(placed: number) {
  "worklet";
  return {
    transform: [
      { translateX: FROM.x + (TARGET.x - FROM.x) * placed },
      { translateY: FROM.y + (TARGET.y - FROM.y) * placed },
      { rotate: `${(1 - placed) * 14}deg` }
    ]
  };
}

function waveFrame(t: number, placed: number) {
  "worklet";
  const visible = placed > 0.95 ? 1 : 0;
  return { opacity: visible * (1 - t) * 0.9, transform: [{ scale: 0.5 + t * 0.9 }] };
}

const WAVE = 160;

const styles = StyleSheet.create({
  wrap: { alignSelf: "center", alignItems: "center", gap: 8 },
  canvas: { width: W, height: H },
  layer: { position: "absolute", left: 0, top: 0 },
  wave: {
    position: "absolute",
    width: WAVE,
    height: WAVE,
    borderRadius: WAVE / 2,
    borderWidth: 4,
    left: TARGET.x + CARD.w / 2 - WAVE / 2,
    top: TARGET.y + CARD.h / 2 - WAVE / 2
  }
});
