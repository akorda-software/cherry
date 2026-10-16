import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { CHATS_PRESENTATION } from "./chats-presentation-config";

/** Un reloj para las celdas visibles, detenido al salir de Chats o de la app. */
export function useChatsNow(focused: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!focused) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const resume = (state: string) => {
      stop();
      if (state !== "active") return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), CHATS_PRESENTATION.relativeTimeIntervalMs);
    };

    resume(AppState.currentState);
    const subscription = AppState.addEventListener("change", resume);
    return () => {
      stop();
      subscription.remove();
    };
  }, [focused]);

  return now;
}
