import { useRouter } from "expo-router";

import { EmptyState, Screen } from "../src/shared/ui";

/** Ruta desconocida (enlace roto, deep link antiguo…): de vuelta al inicio sin dramas. */
export default function NotFoundRoute() {
  const router = useRouter();

  return (
    <Screen tone="lavanda" testID="not-found-screen">
      <EmptyState
        mood="thinking"
        title="Esta pantalla se ha perdido"
        description="Puede que ya no exista o que hayas llegado por un camino antiguo. Te llevamos de vuelta al inicio."
        actionLabel="Volver al inicio"
        actionIcon="home"
        onAction={() => router.replace("/")}
      />
    </Screen>
  );
}
