/**
 * Sombras duras de neobrutalismo: desplazadas, sin desenfoque, en tinta.
 * Se expresan con `boxShadow` (nueva arquitectura en iOS/Android y web), así
 * que se ven igual de duras en las tres plataformas. Al pulsar, el elemento se
 * desplaza hacia su sombra y esta se reduce (ver `pressedElevation`).
 */
import { primitiveColorTokens } from "./color";

const INK = primitiveColorTokens.ink;

export const primitiveElevationTokens = {
  none: { boxShadow: "0px 0px 0px rgba(0, 0, 0, 0)" },
  xs: { boxShadow: `1px 1px 0px ${INK}` },
  sm: { boxShadow: `2px 2px 0px ${INK}` },
  md: { boxShadow: `4px 4px 0px ${INK}` },
  lg: { boxShadow: `6px 6px 0px ${INK}` },
  xl: { boxShadow: `8px 8px 0px ${INK}` }
} as const;

export type ElevationLevel = keyof typeof primitiveElevationTokens;

/** Desplazamiento (px) de cada nivel: lo que se mueve un elemento al pulsarlo. */
export const elevationOffsets: Record<ElevationLevel, number> = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8
};
