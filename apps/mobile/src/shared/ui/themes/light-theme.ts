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

export const lightTheme: AppTheme = {
  name: "light",
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
      screenBackground: primitiveColorTokens.slate50,
      surfaceBackground: primitiveColorTokens.white,
      surfaceElevatedBackground: primitiveColorTokens.slate100
    },
    text: {
      default: primitiveColorTokens.slate900,
      muted: primitiveColorTokens.slate500,
      inverse: primitiveColorTokens.white,
      accent: primitiveColorTokens.blue700
    },
    icon: {
      default: primitiveColorTokens.slate700,
      accent: primitiveColorTokens.blue700,
      muted: primitiveColorTokens.slate500
    },
    surface: {
      base: primitiveColorTokens.white,
      elevated: primitiveColorTokens.slate100,
      selected: "#dbeafe"
    },
    border: {
      subtle: primitiveColorTokens.slate300,
      strong: primitiveColorTokens.slate700,
      accent: primitiveColorTokens.blue600
    },
    action: {
      primaryBackground: primitiveColorTokens.blue600,
      primaryForeground: primitiveColorTokens.white,
      destructiveBackground: primitiveColorTokens.red600,
      destructiveForeground: primitiveColorTokens.white,
      disabledBackground: primitiveColorTokens.slate300,
      disabledForeground: primitiveColorTokens.slate700
    },
    state: {
      info: primitiveColorTokens.blue600,
      success: primitiveColorTokens.emerald600,
      danger: primitiveColorTokens.red600
    },
    layout: {
      contentMaxWidth: primitiveSizeTokens.contentMax,
      touchTargetMinHeight: primitiveSizeTokens.buttonHeight
    }
  }
};
