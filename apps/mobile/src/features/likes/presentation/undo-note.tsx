import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";

import { Button, Icon, Text, useTheme } from "../../../shared/ui";

export interface UndoNoteProps {
  /** Identifica el «no» actual (reinicia el temporizador). `null` = oculta. */
  passKey: string | null;
  name: string;
  undoing: boolean;
  bottomOffset: number;
  onUndo(): void;
  onDismiss(): void;
  /** ms visible (por defecto 5 s). */
  duration?: number;
}

export const UNDO_VISIBLE_MS = 5_000;

/**
 * Nota flotante tras pasar de alguien: «Has pasado de Lucía · Deshacer». Se va sola a los
 * pocos segundos. Sin culpas: deshacer es gratis.
 */
export function UndoNote({
  passKey,
  name,
  undoing,
  bottomOffset,
  onUndo,
  onDismiss,
  duration = UNDO_VISIBLE_MS
}: UndoNoteProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const c = theme.primitives.color;
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (passKey === null || undoing) {
      return undefined;
    }

    const timer = setTimeout(() => dismiss.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, passKey, undoing]);

  if (passKey === null) {
    return null;
  }

  return (
    <View style={[styles.host, { bottom: bottomOffset }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        entering={reduced ? undefined : FadeInDown.duration(240)}
        exiting={FadeOut.duration(160)}
        key={passKey}
        style={[
          styles.note,
          {
            backgroundColor: c.white,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.regular,
            borderRadius: theme.primitives.radius.md
          },
          theme.primitives.elevation.md
        ]}
        testID="likes-undo"
      >
        <View
          style={[
            styles.icon,
            {
              backgroundColor: theme.primitives.pastel.lavanda.fill,
              borderColor: c.ink,
              borderWidth: theme.primitives.border.thin
            }
          ]}
        >
          <Icon color={c.ink} name="x" size={18} />
        </View>
        <Text numberOfLines={2} style={styles.text} variant="bodyStrong">
          Has pasado de {name}
        </Text>
        <Button
          accessibilityLabel={`Deshacer y volver a ver a ${name}`}
          color="limonada"
          icon="undo"
          loading={undoing}
          onPress={onUndo}
          size="sm"
          testID="likes-undo-button"
        >
          Deshacer
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    pointerEvents: "box-none"
  },
  note: {
    alignSelf: "stretch",
    maxWidth: 480,
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    flex: 1
  }
});
