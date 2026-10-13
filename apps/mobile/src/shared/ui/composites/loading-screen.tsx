import { StyleSheet, View } from "react-native";

import { Mascot, PaperBackground } from "../art";
import { LoadingDots } from "../primitives/loading-dots";
import { Text } from "../primitives/text";

export interface LoadingScreenProps {
  /** Frase opcional bajo Mochi (p. ej. «Preparando tu libreta…»). */
  message?: string;
  testID?: string;
}

/** Pantalla completa de espera: papel, Mochi respirando y puntitos. */
export function LoadingScreen({ message, testID }: LoadingScreenProps) {
  return (
    <View accessibilityLabel={message ?? "Cargando"} accessibilityRole="progressbar" style={styles.root} testID={testID}>
      <PaperBackground />
      <Mascot mood="happy" size={120} />
      <LoadingDots size={9} />
      {message ? (
        <Text align="center" color="muted" variant="callout">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 32
  }
});
