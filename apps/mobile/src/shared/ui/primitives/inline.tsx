import type { PropsWithChildren } from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { resolveSpacing, type SpacingKey } from "./stack";

export interface InlineProps extends ViewProps {
  /** Separación entre hijos (por defecto `sm`). */
  gap?: SpacingKey | number;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  /** Salta de línea si no cabe (por defecto sí). */
  wrap?: boolean;
}

/** Fila con separación uniforme; envuelve por defecto (chips, pegatinas). */
export function Inline({
  children,
  style,
  gap = "sm",
  align = "center",
  justify,
  wrap = true,
  ...props
}: PropsWithChildren<InlineProps>) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: wrap ? "wrap" : "nowrap",
          alignItems: align,
          justifyContent: justify,
          gap: resolveSpacing(theme.primitives.spacing, gap)
        },
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
