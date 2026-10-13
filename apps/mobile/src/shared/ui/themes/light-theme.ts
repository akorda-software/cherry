import { primitiveBorderTokens } from "../tokens/primitives/border";
import { pastelSwatches, primitiveColorTokens as c } from "../tokens/primitives/color";
import { primitiveElevationTokens } from "../tokens/primitives/elevation";
import { primitiveMotionTokens } from "../tokens/primitives/motion";
import { primitiveOpacityTokens } from "../tokens/primitives/opacity";
import { primitiveRadiusTokens } from "../tokens/primitives/radius";
import { primitiveSizeTokens } from "../tokens/primitives/size";
import { primitiveSpacingTokens } from "../tokens/primitives/spacing";
import { fontFamilies, primitiveTypographyTokens, textVariantTokens } from "../tokens/primitives/typography";
import type { AppTheme } from "./theme-types";

/**
 * Tema «Libreta kawaii»: neobrutalismo kawaii sobre papel de puntos rosado.
 * Contornos y sombras duras en tinta ciruela, rellenos pastel, tinta encima.
 */
export const lightTheme: AppTheme = {
  name: "libreta-kawaii",
  primitives: {
    color: c,
    pastel: pastelSwatches,
    spacing: primitiveSpacingTokens,
    radius: primitiveRadiusTokens,
    size: primitiveSizeTokens,
    fonts: fontFamilies,
    text: textVariantTokens,
    typography: primitiveTypographyTokens,
    border: primitiveBorderTokens,
    elevation: primitiveElevationTokens,
    opacity: primitiveOpacityTokens,
    motion: primitiveMotionTokens
  },
  semantic: {
    color: {
      screenBackground: c.paper,
      surfaceBackground: c.white,
      surfaceElevatedBackground: c.paperDeep,
      paperDot: c.dot,
      scrim: c.scrim
    },
    text: {
      default: c.ink,
      muted: c.inkSoft,
      faint: c.inkFaint,
      inverse: c.white,
      accent: c.fresaDeep,
      danger: c.tomateDeep,
      success: c.mentaDeep
    },
    icon: {
      default: c.ink,
      accent: c.fresaDeep,
      muted: c.inkSoft
    },
    surface: {
      base: c.white,
      elevated: c.paperDeep,
      selected: c.limonada,
      sunken: c.paperDeep
    },
    border: {
      subtle: c.dot,
      strong: c.ink,
      accent: c.fresaDeep
    },
    action: {
      primaryBackground: c.fresa,
      primaryForeground: c.ink,
      secondaryBackground: c.white,
      secondaryForeground: c.ink,
      destructiveBackground: c.tomate,
      destructiveForeground: c.ink,
      disabledBackground: c.paperDeep,
      disabledForeground: c.inkFaint,
      like: c.fresa,
      pass: c.lavanda,
      undo: c.limonada
    },
    state: {
      info: c.cieloDeep,
      success: c.mentaDeep,
      danger: c.tomateDeep,
      warning: c.limonadaDeep,
      infoSoft: c.cieloSoft,
      successSoft: c.mentaSoft,
      dangerSoft: c.tomateSoft,
      warningSoft: c.limonadaSoft
    },
    tag: {
      neutralBackground: c.white,
      likedBackground: c.menta,
      blockedBackground: c.tomateSoft,
      blockedForeground: c.tomateDeep,
      sharedBackground: c.limonada
    },
    category: {
      interests: pastelSwatches.cielo,
      active: pastelSwatches.menta,
      lifestyle: pastelSwatches.melocoton,
      values: pastelSwatches.lavanda,
      personality: pastelSwatches.limonada,
      pets: pastelSwatches.fresa,
      relationship: pastelSwatches.tomate
    },
    layout: {
      contentMaxWidth: primitiveSizeTokens.contentMax,
      touchTargetMinHeight: primitiveSizeTokens.touchTarget,
      screenPadding: primitiveSpacingTokens.lg,
      tabBarHeight: primitiveSizeTokens.tabBarHeight
    }
  }
};
