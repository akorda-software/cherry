import { primitiveBorderTokens } from "../tokens/primitives/border";
import { primitiveColorTokens } from "../tokens/primitives/color";
import { primitiveElevationTokens } from "../tokens/primitives/elevation";
import { primitiveMotionTokens } from "../tokens/primitives/motion";
import { primitiveOpacityTokens } from "../tokens/primitives/opacity";
import { primitiveRadiusTokens } from "../tokens/primitives/radius";
import { primitiveSizeTokens } from "../tokens/primitives/size";
import { primitiveSpacingTokens } from "../tokens/primitives/spacing";
import { primitiveTypographyTokens } from "../tokens/primitives/typography";
import type { AppTheme } from "./theme-types";

/**
 * Default theme for the app: a neobrutalism palette — warm cream surfaces,
 * near-black ("ink") thick borders, bright accent fills, and hard offset
 * shadows (see primitiveElevationTokens).
 */
export const lightTheme: AppTheme = {
  name: "neobrutal",
  primitives: {
    color: primitiveColorTokens,
    spacing: primitiveSpacingTokens,
    radius: primitiveRadiusTokens,
    size: primitiveSizeTokens,
    typography: primitiveTypographyTokens,
    border: primitiveBorderTokens,
    elevation: primitiveElevationTokens,
    opacity: primitiveOpacityTokens,
    motion: primitiveMotionTokens
  },
  semantic: {
    color: {
      screenBackground: primitiveColorTokens.paper,
      surfaceBackground: primitiveColorTokens.white,
      surfaceElevatedBackground: primitiveColorTokens.cloud
    },
    text: {
      default: primitiveColorTokens.ink,
      muted: "#5C574A",
      inverse: primitiveColorTokens.white,
      accent: primitiveColorTokens.blue
    },
    icon: {
      default: primitiveColorTokens.ink,
      accent: primitiveColorTokens.blue,
      muted: "#5C574A"
    },
    surface: {
      base: primitiveColorTokens.white,
      elevated: primitiveColorTokens.cloud,
      selected: primitiveColorTokens.yellow
    },
    border: {
      subtle: primitiveColorTokens.ink,
      strong: primitiveColorTokens.ink,
      accent: primitiveColorTokens.blue
    },
    action: {
      primaryBackground: primitiveColorTokens.blue,
      primaryForeground: primitiveColorTokens.white,
      destructiveBackground: primitiveColorTokens.red,
      destructiveForeground: primitiveColorTokens.white,
      disabledBackground: primitiveColorTokens.mist,
      disabledForeground: primitiveColorTokens.ink
    },
    state: {
      info: primitiveColorTokens.blue,
      success: primitiveColorTokens.green,
      danger: primitiveColorTokens.red
    },
    layout: {
      contentMaxWidth: primitiveSizeTokens.contentMax,
      touchTargetMinHeight: primitiveSizeTokens.buttonHeight
    }
  }
};
