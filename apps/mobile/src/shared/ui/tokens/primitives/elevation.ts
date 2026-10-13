/**
 * Sombras duras de neobrutalismo: desplazadas abajo a la derecha, sin desenfoque, en tinta.
 *
 * Se pintan SIEMPRE como una vista hermana detrás de la cara (`HardShadow`, o
 * `HardShadowLayer` / `PressableScale` en piezas propias), nunca con `boxShadow`: en
 * Android (Fabric) `boxShadow` es caro de pintar y el mazo de Descubrir iba a tirones
 * (78 % de frames lentos con él, 55 % sin él). Una vista de color no cuesta casi nada.
 * Lo que manda es `elevationOffsets` (px de desplazamiento de cada nivel); al pulsar,
 * el elemento se desplaza hacia su sombra hasta taparla.
 */
import { primitiveColorTokens } from "./color";

const INK = primitiveColorTokens.ink;

/**
 * Heredado, solo por compatibilidad (`theme.primitives.elevation`): NO lo esparzas en
 * estilos. Usa `<HardShadow elevation="md">` (sombra como vista hermana).
 */
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
