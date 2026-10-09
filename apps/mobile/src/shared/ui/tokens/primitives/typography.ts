/**
 * Familias cargadas en app/_layout.tsx (assets/fonts, subconjuntos latinos).
 * En Android cada peso es una familia distinta: nunca uses fontWeight con estas
 * fuentes; elige la familia del peso que quieras.
 */
export const fontFamilies = {
  display: "Rubik-Black",
  regular: "Rubik-Regular",
  medium: "Rubik-Medium",
  bold: "Rubik-Bold",
  extraBold: "Rubik-ExtraBold",
  black: "Rubik-Black",
  /** Antes manuscrita; ahora la misma Rubik (nada de letra «a mano» infantil). */
  hand: "Rubik-Medium"
} as const;

export interface TextVariantToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: "uppercase" | "none";
}

/**
 * Escala tipográfica, toda en Rubik: titulares en Black con interletraje cerrado,
 * interfaz en Medium/Bold/ExtraBold. Los interlineados cubren el ascendente y el
 * descendente de Rubik (≈ 1.19 em) para que «¿», «¡», tildes y «g» nunca se recorten.
 */
export const textVariantTokens = {
  hero: { fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  title1: { fontFamily: fontFamilies.display, fontSize: 30, lineHeight: 37, letterSpacing: -0.7 },
  title2: { fontFamily: fontFamilies.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  title3: { fontFamily: fontFamilies.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18 },
  micro: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  button: { fontFamily: fontFamilies.extraBold, fontSize: 17, lineHeight: 22 },
  buttonSmall: { fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 20 },
  hand: { fontFamily: fontFamilies.medium, fontSize: 17, lineHeight: 24 },
  stamp: { fontFamily: fontFamilies.display, fontSize: 24, lineHeight: 30, letterSpacing: 0.5, textTransform: "uppercase" },
  numeral: { fontFamily: fontFamilies.display, fontSize: 22, lineHeight: 27 }
} as const satisfies Record<string, TextVariantToken>;

export type TextVariant = keyof typeof textVariantTokens;

/**
 * @deprecated escala del tema anterior (fontSize + fontWeight con fuente del
 * sistema). Se mantiene solo mientras se migran las pantallas antiguas.
 */
export const primitiveTypographyTokens = {
  caption: { fontSize: 12, fontWeight: 500 },
  body: { fontSize: 16, fontWeight: 400 },
  bodyStrong: { fontSize: 16, fontWeight: 700 },
  subtitle: { fontSize: 18, fontWeight: 800 },
  title: { fontSize: 28, fontWeight: 800 }
} as const;
