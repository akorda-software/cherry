import type { primitiveBorderTokens } from "../tokens/primitives/border";
import type { primitiveColorTokens } from "../tokens/primitives/color";
import type { primitiveElevationTokens } from "../tokens/primitives/elevation";
import type { primitiveMotionTokens } from "../tokens/primitives/motion";
import type { primitiveOpacityTokens } from "../tokens/primitives/opacity";
import type { primitiveRadiusTokens } from "../tokens/primitives/radius";
import type { primitiveSizeTokens } from "../tokens/primitives/size";
import type { primitiveSpacingTokens } from "../tokens/primitives/spacing";
import type { primitiveTypographyTokens } from "../tokens/primitives/typography";

export interface AppTheme {
  name: string;
  primitives: {
    color: typeof primitiveColorTokens;
    spacing: typeof primitiveSpacingTokens;
    radius: typeof primitiveRadiusTokens;
    size: typeof primitiveSizeTokens;
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
    };
    text: {
      default: string;
      muted: string;
      inverse: string;
      accent: string;
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
    };
    border: {
      subtle: string;
      strong: string;
      accent: string;
    };
    action: {
      primaryBackground: string;
      primaryForeground: string;
      destructiveBackground: string;
      destructiveForeground: string;
      disabledBackground: string;
      disabledForeground: string;
    };
    state: {
      info: string;
      success: string;
      danger: string;
    };
    layout: {
      contentMaxWidth: number;
      touchTargetMinHeight: number;
    };
  };
}

export interface CreateThemeInput {
  name: string;
  semantic?: Partial<{
    [K in keyof AppTheme["semantic"]]: Partial<AppTheme["semantic"][K]>;
  }>;
}
