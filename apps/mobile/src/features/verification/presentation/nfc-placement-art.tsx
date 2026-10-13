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

import { useTheme } from "../../../shared/ui";

const W = 260;
const H = 236;
const PHONE = { x: 70, y: 8, w: 120, h: 220 };
const CARD = { w: 150, h: 96 };
/** Dónde acaba la tarjeta: sobre la parte de arriba del móvil, a la altura de la cámara. */
const TARGET = { x: 55, y: 26 };
/** Desde dónde llega (abajo a la derecha, fuera del móvil). */
const FROM = { x: 100, y: 130 };

export type NfcPlacementMode = "guide" | "reading";

/**
 * Dibujo animado de cómo colocar el documento: la tarjeta llega a la parte de atrás del móvil,
 * junto a la cámara, y se queda quieta mientras salen ondas (`guide`, en bucle). En `reading` la
 * tarjeta ya está colocada y solo laten las ondas. Con «reducir movimiento», imagen fija.
 * Geométrico, sin ningún dato real.
 */
export function NfcPlacementArt({ mode = "guide" }: { mode?: NfcPlacementMode }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const ink = theme.primitives.color.ink;
  const paper = theme.primitives.color.white;
  const card = theme.primitives.pastel.cielo;
  const chip = theme.primitives.pastel.limonada;
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
          withDelay(300, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })),
          withDelay(2200, withTiming(0, { duration: 0 }))
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

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.2 + place.value * 1.6),
    transform: [
      { translateX: FROM.x + (TARGET.x - FROM.x) * place.value },
      { translateY: FROM.y + (TARGET.y - FROM.y) * place.value },
      { rotate: `${(1 - place.value) * 14}deg` }
    ]
  }));

  // Dos ondas desfasadas media vuelta; solo se ven con la tarjeta colocada.
  const waveA = useAnimatedStyle(() => waveFrame(wave.value, place.value));
  const waveB = useAnimatedStyle(() => waveFrame((wave.value + 0.5) % 1, place.value));

  return (
    <View
      accessibilityLabel="Dibujo de un DNI apoyado en la parte de atrás del móvil, a la altura de la cámara"
      accessible
      style={styles.wrap}
      testID="nfc-placement-art"
    >
      <Svg height={H} style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} width={W}>
        {/* Móvil por detrás, con sombra dura y el módulo de cámara arriba a la izquierda */}
        <Rect fill={ink} height={PHONE.h} rx={22} width={PHONE.w} x={PHONE.x + 5} y={PHONE.y + 5} />
        <Rect
          fill={paper}
          height={PHONE.h}
          rx={22}
          stroke={ink}
          strokeWidth={3}
          width={PHONE.w}
          x={PHONE.x}
          y={PHONE.y}
        />
        <Rect fill={ink} height={46} opacity={0.12} rx={12} width={40} x={PHONE.x + 12} y={PHONE.y + 12} />
        <Circle cx={PHONE.x + 32} cy={PHONE.y + 24} fill={paper} r={7} stroke={ink} strokeWidth={2} />
        <Circle cx={PHONE.x + 32} cy={PHONE.y + 46} fill={paper} r={7} stroke={ink} strokeWidth={2} />
      </Svg>

      {/* Ondas del NFC, centradas en la zona de la antena */}
      <Animated.View pointerEvents="none" style={[styles.wave, { borderColor: accent.fill }, waveA]} />
      <Animated.View pointerEvents="none" style={[styles.wave, { borderColor: accent.fill }, waveB]} />

      {/* Tarjeta: llega y se queda quieta */}
      <Animated.View pointerEvents="none" style={[styles.card, cardStyle]}>
        <Svg height={CARD.h + 5} viewBox={`0 0 ${CARD.w + 5} ${CARD.h + 5}`} width={CARD.w + 5}>
          <Rect fill={ink} height={CARD.h} rx={10} width={CARD.w} x={4} y={4} />
          <Rect fill={card.soft} height={CARD.h} rx={10} stroke={ink} strokeWidth={2.5} width={CARD.w} x={1} y={1} />
          <Rect fill={paper} height={46} rx={6} stroke={ink} strokeWidth={2} width={34} x={12} y={24} />
          <Rect fill={chip.fill} height={20} rx={4} stroke={ink} strokeWidth={2} width={26} x={110} y={14} />
          {[30, 44, 58].map((y, index) => (
            <Rect fill={ink} height={6} key={y} opacity={0.16} rx={3} width={index === 1 ? 44 : 62} x={56} y={y} />
          ))}
          <Rect fill={ink} height={6} opacity={0.16} rx={3} width={120} x={14} y={80} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function waveFrame(t: number, placed: number) {
  "worklet";
  const visible = placed > 0.95 ? 1 : 0;
  return { opacity: visible * (1 - t) * 0.9, transform: [{ scale: 0.5 + t * 0.9 }] };
}

const WAVE = 150;

const styles = StyleSheet.create({
  wrap: { width: W, height: H, alignSelf: "center" },
  card: { position: "absolute", left: 0, top: 0 },
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
