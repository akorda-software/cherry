import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Mascot, Stack, Text } from "../../../shared/ui";
import { verificationRoutes } from "./verification-routes";

export type VerificationPendingContext = "discover" | "likes" | "chats";

const COPY: Record<VerificationPendingContext, string> = {
  discover: "Hasta que lo hagas, nadie ve tu perfil y tú no ves a nadie. Mientras, puedes dejar tu perfil a tu gusto en Yo.",
  likes: "Aquí verás quién te ha dado like cuando tu perfil esté activo.",
  chats: "Aquí tendrás tus matches y tus chats cuando tu perfil esté activo."
};

/**
 * Estado «pendiente de verificar» de las pestañas sociales: la cuenta existe y el perfil está
 * guardado, pero no se activa hasta comprobar la edad. Distinto de la pausa.
 */
export function VerificationPendingState({ context }: { context: VerificationPendingContext }) {
  const router = useRouter();

  return (
    <View style={styles.center} testID={`verification-pending-${context}`}>
      <Mascot color="limonada" mood="wink" size={132} />
      <Stack align="center" gap="sm">
        <Text accessibilityRole="header" align="center" variant="title2">
          Comprueba tu edad para empezar
        </Text>
        <Text align="center" color="muted" style={styles.copy}>
          {COPY[context]}
        </Text>
      </Stack>
      <Button
        icon="shield-check"
        onPress={() => router.push(verificationRoutes.intro)}
        size="lg"
        testID={`verification-pending-${context}-cta`}
      >
        Comprobar mi edad
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 28
  },
  copy: { maxWidth: 360 }
});
