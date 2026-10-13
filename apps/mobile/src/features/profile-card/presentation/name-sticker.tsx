import { memo } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { type PastelName, Sticker, Text } from "../../../shared/ui";

export interface NameStickerProps {
  name: string;
  age: number | null;
  size?: "md" | "lg";
  /** Relleno de la pegatina (def. blanca). */
  color?: PastelName;
  /** Giro en grados (las pegatinas rara vez están rectas). */
  rotate?: number;
  /** Se pega con un pop al montarse. */
  pop?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Nombre y edad en una pegatina Mochiy troquelada. */
export const NameSticker = memo(function NameSticker({
  name,
  age,
  size = "md",
  color,
  rotate = -2,
  pop = false,
  style,
  testID
}: NameStickerProps) {
  const large = size === "lg";

  return (
    <Sticker
      color={color}
      elevation="sm"
      padding={large ? { x: 14, y: 6 } : { x: 11, y: 4 }}
      pop={pop}
      rim={large ? 5 : 4}
      rotation={rotate}
      style={[styles.self, style]}
      testID={testID}
    >
      <Text
        accessibilityLabel={age === null ? name : `${name}, ${age} años`}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.15}
        numberOfLines={1}
        variant={large ? "title1" : "title2"}
      >
        {name}
        {age === null ? null : (
          <Text maxFontSizeMultiplier={1.15} variant={large ? "title2" : "title3"}>
            {`, ${age}`}
          </Text>
        )}
      </Text>
    </Sticker>
  );
});

const styles = StyleSheet.create({
  self: {
    alignSelf: "flex-start",
    maxWidth: "100%"
  }
});
