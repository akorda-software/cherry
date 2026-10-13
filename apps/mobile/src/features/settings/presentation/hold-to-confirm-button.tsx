import { useCallback, useEffect, useRef, useState } from "react";
import { type AccessibilityActionEvent, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { easings, haptics, Icon, type IconName, LoadingDots, PressableScale, Text, useTheme } from "../../../shared/ui";

/** Lo que hay que mantener pulsado: deliberado, pero sin hacerse eterno. */
export const HOLD_DURATION_MS = 1600;

interface HoldToConfirmButtonProps {
  /** Texto en reposo («Mantén pulsado para borrar»). */
  label: string;
  /** Texto mientras se mantiene («Sigue pulsando…»). */
  holdingLabel: string;
  /** Nombre de la acción para lectores de pantalla («Borrar mi cuenta»). */
  accessibilityLabel: string;
  icon?: IconName;
  duration?: number;
  loading?: boolean;
  disabled?: boolean;
  onConfirm(): void;
  testID?: string;
}

/**
 * Confirmación física: hay que mantenerlo pulsado mientras se llena de tomate. Soltar antes
 * lo vacía enseguida (pulsar despacio, soltar rápido). Con lector de pantalla, la acción
 * «activar» confirma directamente: el paso anterior ya lo explicó todo.
 */
export function HoldToConfirmButton({
  label,
  holdingLabel,
  accessibilityLabel,
  icon = "trash",
  duration = HOLD_DURATION_MS,
  loading = false,
  disabled = false,
  onConfirm,
  testID
}: HoldToConfirmButtonProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmed = useRef(false);
  const blocked = disabled || loading;

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const complete = useCallback(() => {
    timer.current = null;
    confirmed.current = true;
    setHolding(false);
    haptics.heavy();
    onConfirm();
  }, [onConfirm]);

  function start() {
    if (blocked || timer.current) {
      return;
    }

    confirmed.current = false;
    setHolding(true);
    haptics.light();
    progress.value = withTiming(1, { duration, easing: Easing.linear });
    timer.current = setTimeout(complete, duration);
  }

  function release() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    setHolding(false);

    if (!confirmed.current) {
      progress.value = withTiming(0, { duration: 200, easing: easings.out });
    }
  }

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === "activate" && !blocked) {
      confirmed.current = true;
      progress.value = 1;
      onConfirm();
    }
  }

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <PressableScale
      accessibilityActions={[{ name: "activate", label: accessibilityLabel }]}
      accessibilityHint="Mantén pulsado hasta que se llene para confirmar."
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: blocked, busy: loading }}
      aria-busy={loading || undefined}
      disabled={blocked}
      elevation="md"
      faceStyle={[
        styles.face,
        {
          backgroundColor: theme.primitives.pastel.tomate.soft,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.bold,
          borderRadius: theme.primitives.radius.pill
        }
      ]}
      onAccessibilityAction={onAccessibilityAction}
      onPressIn={start}
      onPressOut={release}
      testID={testID}
    >
      <Animated.View style={[styles.fill, { backgroundColor: theme.primitives.pastel.tomate.fill }, fillStyle]} />
      {loading ? (
        <LoadingDots accessibilityLabel="Borrando tu cuenta" color={c.ink} size={8} />
      ) : (
        <View style={styles.row}>
          <Icon name={icon} size={22} />
          <Text numberOfLines={1} variant="button">
            {holding ? holdingLabel : label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  face: {
    minHeight: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "left"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  }
});
