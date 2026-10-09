import { memo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { HardShadow, Icon, Text, useTheme } from "../../../shared/ui";
import { describeIntents, intentsSpokenText, intentsText } from "../domain/intent";

export interface IntentBadgeProps {
  /** `lookingFor` del perfil (1–4 intenciones); se acepta una sola cadena. */
  intents: ReadonlyArray<string> | string | null | undefined;
  size?: "sm" | "md";
  /** Frases completas («Busca una relación») en vez de las etiquetas cortas. */
  sentence?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Qué busca la persona: una chapita pastel con icono por intención (solapadas si hay
 * varias) + el texto de todas unidas con « · ». Distinta de las insignias (que son
 * pastillas) para que se lea como dato del perfil, no como aviso. El texto siempre
 * nombra cada intención: nunca depende solo del color o del icono.
 */
export const IntentBadge = memo(function IntentBadge({ intents, size = "md", sentence = false, style, testID }: IntentBadgeProps) {
  const theme = useTheme();
  const descriptors = describeIntents(intents);
  const text = intentsText(descriptors, sentence);

  if (!text) {
    return null;
  }

  const c = theme.primitives.color;
  const disc = size === "sm" ? 24 : 30;
  // Las chapitas se solapan un poco, como pegatinas una sobre otra.
  const overlap = Math.round(disc * 0.3);

  return (
    <View
      accessibilityLabel={intentsSpokenText(descriptors) ?? text}
      accessible
      accessibilityRole="text"
      style={[styles.row, { gap: size === "sm" ? 6 : 8 }, style]}
      testID={testID}
    >
      <View style={styles.discs}>
        {descriptors.map((descriptor, index) => (
          <HardShadow
            elevation="xs"
            key={descriptor.key === "unknown" ? `unknown-${descriptor.label}` : descriptor.key}
            style={[
              styles.disc,
              {
                width: disc,
                height: disc,
                borderRadius: disc / 2,
                marginLeft: index === 0 ? 0 : -overlap,
                backgroundColor: theme.primitives.pastel[descriptor.tone].fill,
                borderColor: c.ink,
                borderWidth: theme.primitives.border.thin
              }
            ]}
          >
            <Icon color={c.ink} name={descriptor.icon} size={size === "sm" ? 14 : 17} />
          </HardShadow>
        ))}
      </View>
      <Text
        maxFontSizeMultiplier={1.3}
        numberOfLines={sentence ? undefined : 1}
        style={styles.text}
        variant={size === "sm" ? "caption" : "label"}
      >
        {text}
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
  discs: {
    flexDirection: "row",
    alignItems: "center"
  },
  disc: {
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    flexShrink: 1
  }
});
