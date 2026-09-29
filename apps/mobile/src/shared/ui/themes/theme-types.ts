import type { primitiveBorderTokens } from "../tokens/primitives/border";
import type { PastelName, PastelSwatch, primitiveColorTokens } from "../tokens/primitives/color";
import type { primitiveElevationTokens } from "../tokens/primitives/elevation";
import type { primitiveMotionTokens } from "../tokens/primitives/motion";
import type { primitiveOpacityTokens } from "../tokens/primitives/opacity";
import type { primitiveRadiusTokens } from "../tokens/primitives/radius";
import type { primitiveSizeTokens } from "../tokens/primitives/size";
import type { primitiveSpacingTokens } from "../tokens/primitives/spacing";
import type { fontFamilies, primitiveTypographyTokens, textVariantTokens } from "../tokens/primitives/typography";

export type TagCategoryKey =
  | "interests"
  | "active"
  | "lifestyle"
  | "values"
  | "personality"
  | "pets"
  | "relationship";

export interface AppTheme {
  name: string;
  primitives: {
    color: typeof primitiveColorTokens;
    pastel: Record<PastelName, PastelSwatch>;
    spacing: typeof primitiveSpacingTokens;
    radius: typeof primitiveRadiusTokens;
    size: typeof primitiveSizeTokens;
    fonts: typeof fontFamilies;
    text: typeof textVariantTokens;
    /** @deprecated usar `text` (variantes con familia) */
    typography: typeof primitiveTypographyTokens;
    border: typeof primitiveBorderTokens;
    elevation: typeof primitiveElevationTokens;
    opacity: typeof primitiveOpacityTokens;
    motion: typeof primitiveMotionTokens;
  };
  semantic: {
    color: {
      screenBackground: string;
      surfaceBackground: string;
      surfaceElevatedBackground: string;
      /** Puntos de la trama del papel. */
      paperDot: string;
      scrim: string;
    };
    text: {
      default: string;
      muted: string;
      /** Placeholders y notas secundarias (≥ 4.5:1 sobre papel). */
      faint: string;
      inverse: string;
      accent: string;
      danger: string;
      success: string;
    };
    icon: {
      default: string;
      accent: string;
      muted: string;
    };
    surface: {
      base: string;
      elevated: string;
      selected: string;
      sunken: string;
    };
    border: {
      subtle: string;
      strong: string;
      accent: string;
    };
    action: {
      primaryBackground: string;
      primaryForeground: string;
      secondaryBackground: string;
      secondaryForeground: string;
      destructiveBackground: string;
      destructiveForeground: string;
      disabledBackground: string;
      disabledForeground: string;
      /** Botón y sello de "me gusta". */
      like: string;
      /** Botón y sello de "paso". Suave a propósito: decir que no no es un drama. */
      pass: string;
      /** Deshacer el último "no". */
      undo: string;
    };
    state: {
      info: string;
      success: string;
      danger: string;
      warning: string;
      infoSoft: string;
      successSoft: string;
      dangerSoft: string;
      warningSoft: string;
    };
    tag: {
      neutralBackground: string;
      likedBackground: string;
      blockedBackground: string;
      blockedForeground: string;
      sharedBackground: string;
    };
    /** Color de cada categoría del catálogo de etiquetas. */
    category: Record<TagCategoryKey, PastelSwatch>;
    layout: {
      contentMaxWidth: number;
      touchTargetMinHeight: number;
      screenPadding: number;
      tabBarHeight: number;
    };
  };
}

export interface CreateThemeInput {
  name: string;
  semantic?: Partial<{
    [K in keyof AppTheme["semantic"]]: Partial<AppTheme["semantic"][K]>;
  }>;
}
