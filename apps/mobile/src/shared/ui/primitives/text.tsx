import { forwardRef, type ReactNode } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useTheme } from "../providers/theme-provider";
import type { AppTheme } from "../themes/theme-types";
import type { TextVariant } from "../tokens/primitives/typography";

export type TextColorRole = keyof AppTheme["semantic"]["text"];

export interface TextProps extends RNTextProps {
  /** Variante de `theme.primitives.text` (por defecto `body`). */
  variant?: TextVariant;
  /** Rol de `theme.semantic.text` (`default`, `muted`, `faint`, `accent`…) o un color. */
  color?: TextColorRole | (string & {});
  align?: TextStyle["textAlign"];
  children?: ReactNode;
}

/** Tope de escalado del texto del sistema por variante (titulares y botones aprietan antes). */
const maxScaleByVariant: Partial<Record<TextVariant, number>> = {
  hero: 1.2,
  title1: 1.25,
  title2: 1.3,
  title3: 1.35,
  stamp: 1.2,
  numeral: 1.3,
  button: 1.3,
  buttonSmall: 1.3,
  micro: 1.4,
  label: 1.5,
  caption: 1.5
};

export function resolveTextColor(theme: AppTheme, color: TextProps["color"]): string {
  if (color === undefined) {
    return theme.semantic.text.default;
  }

  return color in theme.semantic.text ? theme.semantic.text[color as TextColorRole] : color;
}

export function textVariantStyle(theme: AppTheme, variant: TextVariant): TextStyle {
  const token = theme.primitives.text[variant] as {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing?: number;
    textTransform?: TextStyle["textTransform"];
  };

  return {
    fontFamily: token.fontFamily,
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    textTransform: token.textTransform
  };
}

/**
 * Texto de la libreta. Nunca uses `fontWeight` con estas fuentes: cambia de
 * variante (cada peso es una familia distinta en Android).
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", color, align, style, maxFontSizeMultiplier, ...props },
  ref
) {
  const theme = useTheme();

  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? maxScaleByVariant[variant] ?? 1.6}
      style={[
        textVariantStyle(theme, variant),
        { color: resolveTextColor(theme, color), margin: 0 },
        align ? { textAlign: align } : null,
        style
      ]}
      {...props}
    />
  );
});
