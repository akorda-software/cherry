import { memo } from "react";
import { StyleSheet, View } from "react-native";

import {
  Icon,
  type IconName,
  type PastelName,
  PopIn,
  PressableScale,
  Stack,
  Text,
  useTheme
} from "../../../../shared/ui";

export interface ChoiceCardProps {
  label: string;
  description?: string;
  icon?: IconName;
  selected: boolean;
  /** Casilla (varias) o botón de radio (una). */
  multiple?: boolean;
  /** Pastel del relleno al elegirla. */
  color: PastelName;
  size?: "md" | "lg";
  disabled?: boolean;
  onPress(): void;
  testID?: string;
}

/**
 * Tarjeta de opción grande (una pregunta, un toque). Elegida: se rellena de
 * pastel, se hunde hacia su sombra y aparece la marca: el estado nunca depende
 * solo del color.
 */
export const ChoiceCard = memo(function ChoiceCard({
  label,
  description,
  icon,
  selected,
  multiple = false,
  color,
  size = "lg",
  disabled = false,
  onPress,
  testID
}: ChoiceCardProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const swatch = theme.primitives.pastel[color];
  const large = size === "lg";

  return (
    <PressableScale
      accessibilityHint={multiple ? "Toca para marcar o desmarcar" : undefined}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      elevation={selected ? "sm" : "md"}
      faceStyle={[
        styles.face,
        {
          minHeight: large ? 76 : 60,
          paddingVertical: large ? 16 : 12,
          paddingHorizontal: large ? 18 : 16,
          borderRadius: theme.primitives.radius.lg,
          borderWidth: theme.primitives.border.bold,
          borderColor: c.ink,
          backgroundColor: selected ? swatch.fill : c.white
        }
      ]}
      haptic={selected ? false : "selection"}
      onPress={onPress}
      releaseSpring="pop"
      testID={testID}
    >
      {icon ? (
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: selected ? c.white : swatch.soft,
              borderColor: c.ink,
              borderWidth: theme.primitives.border.thin
            }
          ]}
        >
          <Icon color={c.ink} fill={selected ? swatch.fill : undefined} name={icon} size={24} />
        </View>
      ) : null}
      <Stack flex gap={2}>
        <Text maxFontSizeMultiplier={1.4} variant={large ? "title3" : "bodyStrong"}>
          {label}
        </Text>
        {description ? (
          <Text color="muted" maxFontSizeMultiplier={1.4} variant="callout">
            {description}
          </Text>
        ) : null}
      </Stack>
      <View
        style={[
          styles.mark,
          {
            borderRadius: multiple ? theme.primitives.radius.xs + 2 : 14,
            borderWidth: theme.primitives.border.regular,
            borderColor: c.ink,
            backgroundColor: selected ? c.ink : c.white
          }
        ]}
      >
        {selected ? (
          <PopIn>
            <Icon color={c.white} name="check" size={18} strokeWidth={3} />
          </PopIn>
        ) : null}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  face: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  mark: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  }
});
