import { useSessionStore } from "../../auth/presentation/session-store";

/**
 * Ejecuta `callback` cuando se cierra la sesión (de «signed-in» a cualquier otro estado),
 * para que likes, matches y badges de una cuenta nunca se vean en otra.
 */
export function onSignOut(callback: () => void): () => void {
  return useSessionStore.subscribe((state, previous) => {
    if (previous.status === "signed-in" && state.status !== "signed-in") {
      callback();
    }
  });
}
