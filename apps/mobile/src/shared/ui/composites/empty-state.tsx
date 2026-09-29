import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { type IconName, Mascot, type MascotMood } from "../art";
import { Appear } from "../motion/appear";
import { PopIn } from "../motion/pop";
import { Button } from "../primitives/button";
import { Heading } from "../primitives/heading";
import { Text } from "../primitives/text";
import type { PastelName } from "../tokens/primitives/color";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Cara de Mochi (por defecto `happy`). */
  mood?: MascotMood;
  mascotColor?: PastelName;
  /** Sustituye a Mochi por otra ilustración (`null` = sin ilustración). */
  illustration?: ReactNode | null;
  /** Acción principal ya construida (o usa `actionLabel` + `onAction`). */
  action?: ReactNode;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?(): void;
  secondaryLabel?: string;
  onSecondary?(): void;
  /** Versión reducida para dentro de listas. */
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Estado vacío con Mochi: qué pasa aquí y una acción útil para seguir. */
export function EmptyState({
  title,
  description,
  mood = "happy",
  mascotColor,
  illustration,
  action,
  actionLabel,
  actionIcon,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
  testID,
  style
}: EmptyStateProps) {
  const art =
    illustration === undefined ? <Mascot color={mascotColor} mood={mood} size={compact ? 96 : 148} /> : illustration;

  return (
    <View style={[styles.root, compact ? styles.compact : null, style]} testID={testID}>
      {art ? (
        <PopIn fromScale={0.8} rotate={-3}>
          {art}
        </PopIn>
      ) : null}
      <Appear delay={80} style={styles.texts}>
        <Heading align="center" level={2} variant={compact ? "title3" : "title2"}>
          {title}
        </Heading>
        {description ? (
          <Text align="center" color="muted" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </Appear>
      {action || actionLabel || secondaryLabel ? (
        <Appear delay={160} style={styles.actions}>
          {action}
          {actionLabel && onAction ? <Button icon={actionIcon} label={actionLabel} onPress={onAction} /> : null}
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} onPress={onSecondary} size="sm" variant="ghost" />
          ) : null}
        </Appear>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 32
  },
  compact: {
    flexGrow: 0,
    gap: 14,
    paddingVertical: 20
  },
  texts: {
    alignItems: "center",
    gap: 8,
    maxWidth: 340
  },
  description: {
    maxWidth: 320
  },
  actions: {
    alignItems: "center",
    gap: 12,
    marginTop: 4
  }
});
