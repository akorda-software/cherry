import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ¿Está enfocada esta pantalla? Llama a `onFocus(first)` cada vez que gana el foco
 * (`first = true` la primera vez, útil para no duplicar la carga del montaje).
 */
export function useScreenFocus(onFocus?: (first: boolean) => void): boolean {
  const [focused, setFocused] = useState(false);
  const first = useRef(true);
  const callback = useRef(onFocus);

  useEffect(() => {
    callback.current = onFocus;
  });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      callback.current?.(first.current);
      first.current = false;

      return () => setFocused(false);
    }, [])
  );

  return focused;
}

/** `true` pasado `delayMs` seguidos con `active`; vuelve a `false` al instante. */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    if (!active) {
      setFlag(false);
      return undefined;
    }

    const timer = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return flag;
}
