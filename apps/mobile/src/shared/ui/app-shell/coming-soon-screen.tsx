import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Mascot, Sparkle } from "../art";

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
        description="Esta pantalla estará lista muy pronto."
        illustration={
          <View>
            <Mascot mood="thinking" size={148} />
            <Sparkle color="limonada" rotation={10} size={28} style={styles.sparkle} />
            <Sparkle color="cielo" rotation={-8} size={16} style={styles.sparkleSmall} />
          </View>
        }
        title="Estamos preparando esta pantalla"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sparkle: {
    position: "absolute",
    top: 6,
    right: -18
  },
  sparkleSmall: {
    position: "absolute",
    top: 38,
    left: -14
  }
});
