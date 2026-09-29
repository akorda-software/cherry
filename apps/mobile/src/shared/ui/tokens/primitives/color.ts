/**
 * «Libreta kawaii»: papel de puntos rosado, tinta ciruela y rotuladores pastel.
 *
 * Cada pastel tiene tres tonos:
 * - base (`fresa`): relleno de botones, pegatinas y sellos; la tinta encima da ≥ 7:1.
 * - `Soft`: fondos de página, notas y estados suaves.
 * - `Deep`: texto o iconos de acento sobre papel o sobre su `Soft` (≥ 4.5:1).
 * Nunca texto blanco sobre pastel: sobre color siempre va tinta.
 */
export const primitiveColorTokens = {
  // Tinta y papel
  ink: "#2B1938",
  inkSoft: "#6B5680",
  inkFaint: "#7A6690",
  paper: "#FFF6FB",
  paperDeep: "#FBE9F3",
  dot: "#E9D5EC",
  white: "#FFFFFF",

  // Rotuladores pastel
  fresa: "#FF9EC7",
  fresaSoft: "#FFD6E8",
  fresaDeep: "#B0154F",
  menta: "#8FE3C0",
  mentaSoft: "#D2F6E7",
  mentaDeep: "#136E4D",
  lavanda: "#C3B1FF",
  lavandaSoft: "#E8E0FF",
  lavandaDeep: "#5B3FC4",
  limonada: "#FFE680",
  limonadaSoft: "#FFF5C7",
  limonadaDeep: "#7A5800",
  cielo: "#9FD3FF",
  cieloSoft: "#DCEFFF",
  cieloDeep: "#1A62A0",
  melocoton: "#FFBE98",
  melocotonSoft: "#FFE5D6",
  melocotonDeep: "#9E4018",
  tomate: "#FF8A7A",
  tomateSoft: "#FFD9D3",
  tomateDeep: "#B3261E",

  // Velos (tinta translúcida) para fondos de modales y lectura sobre foto
  scrim: "rgba(43, 25, 56, 0.45)",
  scrimStrong: "rgba(43, 25, 56, 0.72)",

  /** @deprecated alias del tema neobrutal anterior; usar los tonos de arriba. */
  cloud: "#FBE9F3",
  /** @deprecated */
  mist: "#E9D5EC",
  /** @deprecated */
  blue: "#5B3FC4",
  /** @deprecated */
  blueDark: "#2B1938",
  /** @deprecated */
  red: "#FF8A7A",
  /** @deprecated */
  pink: "#FF9EC7",
  /** @deprecated */
  yellow: "#FFE680",
  /** @deprecated */
  green: "#8FE3C0",
  /** @deprecated */
  purple: "#C3B1FF",
  /** @deprecated */
  orange: "#FFBE98",
  /** @deprecated */
  slate50: "#FFF6FB",
  /** @deprecated */
  slate100: "#FBE9F3",
  /** @deprecated */
  slate300: "#E9D5EC",
  /** @deprecated */
  slate500: "#7A6690",
  /** @deprecated */
  slate700: "#6B5680",
  /** @deprecated */
  slate900: "#2B1938",
  /** @deprecated */
  blue600: "#5B3FC4",
  /** @deprecated */
  blue700: "#2B1938",
  /** @deprecated */
  red600: "#B3261E",
  /** @deprecated */
  amber500: "#FFE680",
  /** @deprecated */
  emerald600: "#136E4D"
} as const;

export type PastelName = "fresa" | "menta" | "lavanda" | "limonada" | "cielo" | "melocoton" | "tomate";

export interface PastelSwatch {
  fill: string;
  soft: string;
  deep: string;
}

export const pastelSwatches: Record<PastelName, PastelSwatch> = {
  fresa: { fill: primitiveColorTokens.fresa, soft: primitiveColorTokens.fresaSoft, deep: primitiveColorTokens.fresaDeep },
  menta: { fill: primitiveColorTokens.menta, soft: primitiveColorTokens.mentaSoft, deep: primitiveColorTokens.mentaDeep },
  lavanda: {
    fill: primitiveColorTokens.lavanda,
    soft: primitiveColorTokens.lavandaSoft,
    deep: primitiveColorTokens.lavandaDeep
  },
  limonada: {
    fill: primitiveColorTokens.limonada,
    soft: primitiveColorTokens.limonadaSoft,
    deep: primitiveColorTokens.limonadaDeep
  },
  cielo: { fill: primitiveColorTokens.cielo, soft: primitiveColorTokens.cieloSoft, deep: primitiveColorTokens.cieloDeep },
  melocoton: {
    fill: primitiveColorTokens.melocoton,
    soft: primitiveColorTokens.melocotonSoft,
    deep: primitiveColorTokens.melocotonDeep
  },
  tomate: { fill: primitiveColorTokens.tomate, soft: primitiveColorTokens.tomateSoft, deep: primitiveColorTokens.tomateDeep }
};
