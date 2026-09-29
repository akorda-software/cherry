import type { ReactNode } from "react";

import { EmptyState } from "../composites/empty-state";
import { TopBar } from "../composites/top-bar";
import { Screen } from "../primitives/screen";
import type { PastelName } from "../tokens/primitives/color";

export interface ComingSoonScreenProps {
  title: string;
  /** Con flecha atrás (pantallas apiladas) o título grande (pestañas). */
  back?: boolean;
  /** Botón de cerrar en vez de atrás (pantallas modales). */
  close?: boolean;
  tone?: PastelName;
  /** Acciones de la cabecera. */
  right?: ReactNode;
  testID?: string;
}

/** Marcador digno para rutas cuyo diseño está en camino. */
export function ComingSoonScreen({ title, back = true, close = false, tone, right, testID }: ComingSoonScreenProps) {
  return (
    <Screen
      header={
        <TopBar
          left={close ? "close" : back ? "back" : undefined}
          right={right}
          size={back || close ? "normal" : "large"}
          title={title}
        />
      }
      testID={testID}
      tone={tone}
    >
      <EmptyState
        description="Mochi está recortando pegatinas y ordenando la libreta. Muy pronto estará lista."
        mood="thinking"
        title="Estamos preparando esta página ✨"
      />
    </Screen>
  );
}
