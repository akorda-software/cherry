import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * ¿Hay lector de pantalla activo? Con él no se avanza solo al elegir una
 * opción: cambiar de pantalla sin pedirlo desorienta.
 */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // react-native-web siempre responde «sí»: en web no hay forma fiable de saberlo.
    if (Platform.OS === "web") {
      return undefined;
    }

    let active = true;

    AccessibilityInfo.isScreenReaderEnabled?.()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener?.("screenReaderChanged", (value: boolean) => setEnabled(value));

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return enabled;
}
