import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";

import type { TextVariant } from "../tokens/primitives/typography";
import { Text, type TextProps } from "./text";

const variantByLevel: Record<1 | 2 | 3 | 4, TextVariant> = {
  1: "title1",
  2: "title2",
  3: "title3",
  4: "bodyStrong"
};

export interface HeadingProps extends Omit<TextProps, "variant" | "role"> {
  /** 1 → title1, 2 → title2, 3 → title3, 4 → bodyStrong. */
  level?: 1 | 2 | 3 | 4;
  /** Fuerza una variante concreta manteniendo el rol de encabezado. */
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

/** Encabezado accesible (rol heading + nivel) sobre las variantes de título. */
export function Heading({ children, level = 2, variant, ...props }: HeadingProps) {
  return (
    <Text role="heading" aria-level={level} variant={variant ?? variantByLevel[level]} {...props}>
      {children}
    </Text>
  );
}
