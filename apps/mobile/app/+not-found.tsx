import { useRouter } from "expo-router";

import { EmptyState, Screen } from "../src/shared/ui";

/** Ruta desconocida (enlace roto, deep link antiguo…): de vuelta al inicio sin dramas. */
export default function NotFoundRoute() {
  const router = useRouter();

  return (
    <Screen tone="lavanda" testID="not-found-screen">
      <EmptyState
        mood="thinking"
        title="Esta página se ha perdido"
        description="Puede que el enlace sea antiguo o que la página ya no exista. Te llevamos de vuelta a casa."
        actionLabel="Volver al inicio"
        actionIcon="home"
        onAction={() => router.replace("/")}
      />
    </Screen>
  );
}
