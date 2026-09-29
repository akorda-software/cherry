/**
 * Familias cargadas en app/_layout.tsx (assets/fonts, subconjuntos latinos).
 * En Android cada peso es una familia distinta: nunca uses fontWeight con estas
 * fuentes; elige la familia del peso que quieras.
 */
export const fontFamilies = {
  display: "MochiyPopOne",
  regular: "MPLUSRounded1c-Regular",
  medium: "MPLUSRounded1c-Medium",
  bold: "MPLUSRounded1c-Bold",
  extraBold: "MPLUSRounded1c-ExtraBold",
  black: "MPLUSRounded1c-Black",
  hand: "Yomogi"
} as const;

export interface TextVariantToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: "uppercase" | "none";
}

/**
 * Escala tipográfica. Titulares en Mochiy Pop One (pop japonés), interfaz y
 * texto en M PLUS Rounded 1c, anotaciones manuscritas en Yomogi (≥ 18 pt).
 */
export const textVariantTokens = {
  hero: { fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 46, letterSpacing: -0.4 },
  title1: { fontFamily: fontFamilies.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  title2: { fontFamily: fontFamilies.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  title3: { fontFamily: fontFamilies.display, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: fontFamilies.medium, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fontFamilies.extraBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fontFamilies.bold, fontSize: 13, lineHeight: 18 },
  micro: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  button: { fontFamily: fontFamilies.extraBold, fontSize: 17, lineHeight: 22 },
  buttonSmall: { fontFamily: fontFamilies.extraBold, fontSize: 15, lineHeight: 20 },
  hand: { fontFamily: fontFamilies.hand, fontSize: 20, lineHeight: 25 },
  stamp: { fontFamily: fontFamilies.display, fontSize: 26, lineHeight: 30, letterSpacing: 1, textTransform: "uppercase" },
  numeral: { fontFamily: fontFamilies.display, fontSize: 22, lineHeight: 26 }
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
