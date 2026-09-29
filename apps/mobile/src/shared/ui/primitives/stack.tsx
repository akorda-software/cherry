import type { PropsWithChildren } from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { useTheme } from "../providers/theme-provider";
import type { primitiveSpacingTokens } from "../tokens/primitives/spacing";

export type SpacingKey = keyof typeof primitiveSpacingTokens;

export interface StackProps extends ViewProps {
  /** Separación entre hijos: clave de espaciado o px (por defecto `md`). */
  gap?: SpacingKey | number;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  /** Ocupa el espacio disponible del padre. */
  flex?: boolean;
}

export function resolveSpacing(spacing: Record<SpacingKey, number>, value: SpacingKey | number) {
  return typeof value === "number" ? value : spacing[value];
}

/** Columna con separación uniforme. */
export function Stack({ children, style, gap = "md", align, justify, flex, ...props }: PropsWithChildren<StackProps>) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          gap: resolveSpacing(theme.primitives.spacing, gap),
          alignItems: align,
          justifyContent: justify
        },
        flex ? { flex: 1 } : null,
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
