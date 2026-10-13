import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const nativeHaptics = Platform.OS === "ios" || Platform.OS === "android";

function fire(run: () => Promise<void>) {
  if (!nativeHaptics) {
    return;
  }

  run().catch(() => undefined);
}

/**
 * Hápticos de la app (no-op en web). Úsalos solo en momentos clave:
 * seleccionar etiqueta (`selection`), cruzar el umbral de swipe (`light`),
 * like (`medium`), match (`success`), errores (`error`).
 */
export const haptics = {
  selection: () => fire(() => Haptics.selectionAsync()),
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
} as const;

export type HapticKind = keyof typeof haptics;

/** Dispara un háptico si `kind` lo indica (`true` = `light`). */
export function triggerHaptic(kind: HapticKind | boolean | undefined) {
  if (!kind) {
    return;
  }

  haptics[kind === true ? "light" : kind]();
}
