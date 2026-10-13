import { Children, isValidElement, type PropsWithChildren, type ReactNode, useState } from "react";
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import type { IconName } from "../art";
import { Divider } from "../primitives/divider";
import { IconSlot } from "../primitives/icon-slot";
import { Surface } from "../primitives/surface";
import { Switch } from "../primitives/switch";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";

export interface ListRowProps {
  label: string;
  description?: string;
  icon?: IconName;
  /** Pastel del círculo del icono (por defecto lavanda; tomate si `danger`). */
  iconColor?: PastelName;
  /** Valor a la derecha (p. ej. «25 km»). */
  value?: string;
  /** `chevron` (navega), `switch` (interruptor) o un nodo. Por defecto chevron si hay `onPress`. */
  trailing?: "chevron" | "switch" | "none" | ReactNode;
  switchValue?: boolean;
  onSwitchChange?(value: boolean): void;
  /** Acción destructiva (texto e icono en tomate). */
  danger?: boolean;
  disabled?: boolean;
  onPress?(): void;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fila de ajustes o lista: icono en círculo pastel, etiqueta, descripción,
 * valor y chevron o interruptor. Dentro de un `ListSection` no lleva sombra
 * propia: al pulsar se resalta.
 */
export function ListRow({
  label,
  description,
  icon,
  iconColor,
  value,
  trailing,
  switchValue,
  onSwitchChange,
  danger = false,
  disabled = false,
  onPress,
  accessibilityHint,
  testID,
  style
}: ListRowProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const [pressed, setPressed] = useState(false);
  const resolvedTrailing = trailing ?? (onSwitchChange ? "switch" : onPress ? "chevron" : "none");
  const circle = danger ? theme.primitives.pastel.tomate.soft : theme.primitives.pastel[iconColor ?? "lavanda"].soft;
  const isSwitch = resolvedTrailing === "switch";

  const content = (
    <>
      {icon ? (
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: circle, borderColor: c.ink, borderWidth: theme.primitives.border.thin }
          ]}
        >
          <IconSlot color={danger ? theme.semantic.state.danger : c.ink} icon={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text color={danger ? "danger" : "default"} variant="bodyStrong">
          {label}
        </Text>
        {description ? (
          <Text color="muted" variant="caption">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text color="muted" numberOfLines={1} style={styles.value} variant="callout">
          {value}
        </Text>
      ) : null}
      {resolvedTrailing === "chevron" ? <IconSlot color={c.inkSoft} icon="chevron-right" size={20} /> : null}
      {isSwitch ? (
        <Switch
          accessibilityLabel={label}
          disabled={disabled}
          onValueChange={onSwitchChange}
          value={Boolean(switchValue)}
        />
      ) : null}
      {isValidElement(resolvedTrailing) ? resolvedTrailing : null}
    </>
  );

  const rowStyle = [
    styles.row,
    { opacity: disabled ? theme.primitives.opacity.disabled : 1 },
    pressed ? { backgroundColor: c.paperDeep } : null,
    style
  ];

  if (onPress && !isSwitch) {
    return (
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={value ? `${label}, ${value}` : label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={rowStyle}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={rowStyle} testID={testID}>
      {content}
    </View>
  );
}

/** Alias semántico para pantallas de ajustes. */
export const SettingsRow = ListRow;

export interface ListSectionProps {
  /** Título de la sección (encabezado, no «eyebrow»). */
  title?: string;
  /** Nota bajo la tarjeta. */
  footnote?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta que agrupa filas separadas por líneas discontinuas. */
export function ListSection({ title, footnote, children, testID, style }: PropsWithChildren<ListSectionProps>) {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.section, style]} testID={testID}>
      {title ? (
        <Text role="heading" style={styles.sectionTitle} variant="title3">
          {title}
        </Text>
      ) : null}
      <Surface clip padding={0} radius="lg">
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <Divider style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </Surface>
      {footnote ? (
        <Text color="muted" style={styles.footnote} variant="caption">
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  texts: {
    flex: 1,
    gap: 2
  },
  value: {
    maxWidth: "40%"
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    paddingHorizontal: 4
  },
  divider: {
    marginHorizontal: 16
  },
  footnote: {
    paddingHorizontal: 4
  }
});
