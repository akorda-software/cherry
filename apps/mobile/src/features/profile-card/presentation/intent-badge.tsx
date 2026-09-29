import { memo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { Icon, Text, useTheme } from "../../../shared/ui";
import { describeIntent } from "../domain/intent";

export interface IntentBadgeProps {
  /** `whatIAmLookingFor` del perfil. */
  intent: string | null | undefined;
  size?: "sm" | "md";
  /** Frase completa («Busca una relación») en vez de la etiqueta corta. */
  sentence?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Qué busca la persona: icono en una chapita pastel + texto. Distinta de las insignias
 * (que son pastillas) para que se lea como dato del perfil, no como aviso.
 */
export const IntentBadge = memo(function IntentBadge({ intent, size = "md", sentence = false, style, testID }: IntentBadgeProps) {
  const theme = useTheme();
  const descriptor = describeIntent(intent);

  if (!descriptor) {
    return null;
  }

  const c = theme.primitives.color;
  const swatch = theme.primitives.pastel[descriptor.tone];
  const disc = size === "sm" ? 24 : 30;

  return (
    <View
      accessibilityLabel={descriptor.sentence}
      accessible
      accessibilityRole="text"
      style={[styles.row, { gap: size === "sm" ? 6 : 8 }, style]}
      testID={testID}
    >
      <View
        style={[
          styles.disc,
          {
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            backgroundColor: swatch.fill,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.thin
          },
          theme.primitives.elevation.xs
        ]}
      >
        <Icon color={c.ink} name={descriptor.icon} size={size === "sm" ? 14 : 17} />
      </View>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} variant={size === "sm" ? "caption" : "label"}>
        {sentence ? descriptor.sentence : descriptor.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1
  },
  disc: {
    alignItems: "center",
    justifyContent: "center"
  }
});
