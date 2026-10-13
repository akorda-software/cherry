import { AppState } from "react-native";

/** Llama a `listener` cada vez que la app vuelve a primer plano. Devuelve la función para soltarlo. */
export function subscribeToAppForeground(listener: () => void): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      listener();
    }
  });

  return () => subscription?.remove();
}
