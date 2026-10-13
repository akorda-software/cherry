import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from "react-native-reanimated";

import { primitiveMotionTokens as motion } from "../tokens/primitives/motion";

export type SpringName = keyof typeof motion.spring;
export type TimingName = "quick" | "calm" | "slow";

/**
 * Muelles de la libreta (ver tokens/primitives/motion.ts):
 * - `pop`: pegatinas y sellos que se pegan (rebote corto).
 * - `soft`: papel, hojas y tarjetas que se asientan.
 * - `snappy`: botones que se hunden hacia su sombra.
 * - `wobbly`: mascota y celebraciones.
 * Con «reducir movimiento» del sistema, reanimated salta al valor final.
 */
export const springs: Record<SpringName, WithSpringConfig> = {
  pop: { ...motion.spring.pop, reduceMotion: ReduceMotion.System },
  soft: { ...motion.spring.soft, reduceMotion: ReduceMotion.System },
  snappy: { ...motion.spring.snappy, reduceMotion: ReduceMotion.System },
  wobbly: { ...motion.spring.wobbly, reduceMotion: ReduceMotion.System }
};

const [q1, q2, q3, q4] = motion.easing.outQuint;
const [b1, b2, b3, b4] = motion.easing.outBack;
const [i1, i2, i3, i4] = motion.easing.inOut;

/** Curvas: salida fuerte para entradas, inOut para lo que se mueve en pantalla. */
export const easings = {
  out: Easing.bezier(q1, q2, q3, q4),
  outBack: Easing.bezier(b1, b2, b3, b4),
  inOut: Easing.bezier(i1, i2, i3, i4)
};

/** Duraciones con curva de salida (entradas, fundidos, cambios de color). */
export const timings: Record<TimingName, WithTimingConfig> = {
  quick: { duration: motion.quick, easing: easings.out },
  calm: { duration: motion.calm, easing: easings.out },
  slow: { duration: motion.slow, easing: easings.out }
};

/** Retardo escalonado para listas que entran (tope para no hacer esperar). */
export function stagger(index: number, step = 45, base = 0, maxSteps = 8): number {
  return base + Math.min(Math.max(index, 0), maxSteps) * step;
}
