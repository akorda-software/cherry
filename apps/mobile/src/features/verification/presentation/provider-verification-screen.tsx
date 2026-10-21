import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { createVerificationApi } from "@cherry/mobile-shared";

import { appShellRoutes, Button, Icon, LoadingDots, Mascot, Screen, Stack, Surface, Text, TopBar } from "../../../shared/ui";
import { refreshBootstrap } from "../../app-bootstrap";
import { useAuthedApi, useLogoutAction } from "../../auth/presentation";
import { type ProviderVerificationDeps, useProviderVerification } from "../application/use-provider-verification";
import { PROVIDER_CONSENT, PROVIDER_DATA_SUMMARY, PROVIDER_REQUIREMENTS, PROVIDER_STEPS } from "../domain/verification-copy";
import { PROVIDER_RETURN_PATH } from "./verification-routes";

/** `<esquema de la app>://verify/selfie/return`: adónde manda el proveedor al terminar. */
function providerReturnUrl(): string {
  const scheme = Constants.expoConfig?.scheme;
  const name = (Array.isArray(scheme) ? scheme[0] : scheme) ?? "cherry";
  return `${name}://${PROVIDER_RETURN_PATH}`;
}

async function openBrowser(url: string, returnUrl: string) {
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl, { showInRecents: true });
  return result.type === "success" ? ("returned" as const) : ("closed" as const);
}

function useProviderDeps(): ProviderVerificationDeps {
  const callApi = useAuthedApi(createVerificationApi);

  return useMemo(
    () => ({
      startSession: (callback) => callApi((api) => api.startProvider(callback)),
      checkSession: (sessionId) => callApi((api) => api.checkProvider(sessionId)),
      openBrowser,
      returnUrl: providerReturnUrl(),
      // Activa el perfil: el bootstrap deja de estar «pendiente de verificar».
      onVerified: refreshBootstrap
    }),
    [callApi]
  );
}

/**
 * Verificación con un selfie y una foto del documento, en la página de Didit. Para quien no tiene
 * NFC o un documento con chip. Se llega desde «¿Cómo quieres hacerlo?».
 */
export function ProviderVerificationScreen() {
  const router = useRouter();
  const logout = useLogoutAction();
  const flow = useProviderVerification(useProviderDeps());
  const { phase, error } = flow.state;

  const leave = useCallback(() => router.back(), [router]);
  const finish = useCallback(() => router.replace(appShellRoutes.discover), [router]);

  const footer = (() => {
    switch (phase) {
      case "intro":
        return (
          <Button fullWidth icon="external" onPress={() => void flow.open()} size="lg" testID="provider-start">
            Aceptar y empezar
          </Button>
        );
      case "pending":
        return (
          <Stack gap="sm">
            <Button fullWidth onPress={flow.recheck} size="lg" testID="provider-recheck">
              Ya he terminado
            </Button>
            <Button icon="external" onPress={() => void flow.open()} testID="provider-reopen" variant="ghost">
              Seguir en Didit
            </Button>
          </Stack>
        );
      case "in_review":
        return (
          <Stack gap="sm">
            <Button fullWidth icon="refresh" onPress={flow.recheck} size="lg" testID="provider-recheck">
              Comprobar otra vez
            </Button>
            <Button onPress={leave} variant="ghost">
              Salir
            </Button>
          </Stack>
        );
      case "success":
        return (
          <Button fullWidth onPress={finish} size="lg" testID="provider-done">
            Empezar a usar Cherry
          </Button>
        );
      case "error":
        return error ? (
          <Stack gap="sm">
            {error.action === "retry" ? (
              <Button fullWidth onPress={flow.retry} size="lg" testID="provider-retry">
                Reintentar
              </Button>
            ) : null}
            {error.action === "sign_out" ? (
              <Button fullWidth onPress={() => void logout()} size="lg" testID="provider-sign-out">
                Salir
              </Button>
            ) : (
              <Button onPress={leave} variant="ghost">
                Salir
              </Button>
            )}
          </Stack>
        ) : null;
      default:
        return null;
    }
  })();

  return (
    <Screen
      footer={footer}
      header={<TopBar left="close" testID="provider-top-bar" title="Comprobar tu edad" />}
      scroll
      testID="provider-verification-screen"
    >
      {phase === "intro" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              Con un selfie y tu documento
            </Text>
            <Text color="muted">
              Lo hace Didit, una empresa de verificación de identidad. Comprueba que el documento es auténtico y que la
              cara es la tuya.
            </Text>
          </Stack>
          <Surface color="limonada" padding="md" radius="lg" soft>
            <Stack gap="sm">
              <Text variant="bodyStrong">Qué necesitas</Text>
              {PROVIDER_REQUIREMENTS.map((item) => (
                <View key={item.text} style={styles.requirement}>
                  <Icon name={item.icon} size={18} />
                  <Text style={styles.flex} variant="callout">
                    {item.text}
                  </Text>
                </View>
              ))}
            </Stack>
          </Surface>
          <Stack gap="sm" testID="provider-steps">
            {PROVIDER_STEPS.map((text, index) => (
              <View key={text} style={styles.step}>
                <Surface border="thin" color="cielo" elevation="sm" padding={0} radius="pill" style={styles.stepNumber}>
                  <Text align="center" variant="label">
                    {String(index + 1)}
                  </Text>
                </Surface>
                <Text style={styles.flex} variant="callout">
                  {text}
                </Text>
              </View>
            ))}
          </Stack>
          {PROVIDER_DATA_SUMMARY.map((item) => (
            <View key={item.title} style={styles.row}>
              <Surface border="thin" color="limonada" elevation="sm" padding="sm" radius="pill" soft>
                <Icon name={item.icon} size={20} />
              </Surface>
              <Stack flex gap="xs">
                <Text variant="bodyStrong">{item.title}</Text>
                <Text color="muted" variant="callout">
                  {item.body}
                </Text>
              </Stack>
            </View>
          ))}
          <Text color="muted" testID="provider-consent" variant="callout">
            {PROVIDER_CONSENT}
          </Text>
        </Stack>
      ) : null}

      {phase === "opening" || phase === "checking" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot color="menta" mood="thinking" size={132} />
          <Text accessibilityRole="header" align="center" testID="provider-busy" variant="title2">
            {phase === "opening" ? "Abriendo Didit" : "Comprobando el resultado"}
          </Text>
          <LoadingDots />
        </Stack>
      ) : null}

      {phase === "pending" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot color="limonada" mood="wink" size={132} />
          <Text accessibilityRole="header" align="center" testID="provider-pending" variant="title2">
            ¿Has terminado?
          </Text>
          <Text align="center" color="muted">
            Todavía no tenemos la respuesta. Si te quedaste a medias, sigue en Didit; si ya acabaste, vuelve a
            comprobarlo en unos segundos.
          </Text>
        </Stack>
      ) : null}

      {phase === "in_review" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot color="cielo" mood="thinking" size={132} />
          <Text accessibilityRole="header" align="center" testID="provider-in-review" variant="title2">
            Lo está revisando una persona
          </Text>
          <Text align="center" color="muted">
            Las fotos no eran del todo claras y una persona lo revisa a mano. Puede tardar un rato: vuelve más tarde y
            compruébalo.
          </Text>
        </Stack>
      ) : null}

      {phase === "success" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot animated color="menta" mood="celebrate" size={148} />
          <Text accessibilityRole="header" align="center" testID="provider-success" variant="title1">
            Listo: tu perfil ya está activo
          </Text>
          <Text align="center" color="muted">
            Hemos guardado solo que eres mayor de edad, la fecha y la huella cifrada del documento, y le hemos pedido a
            Didit que borre las fotos.
          </Text>
        </Stack>
      ) : null}

      {phase === "error" && error ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot color="lavanda" mood="sad" size={132} />
          <Text accessibilityRole="header" align="center" testID="provider-error-title" variant="title2">
            {error.title}
          </Text>
          <Text align="center" color="muted">
            {error.message}
          </Text>
          {__DEV__ && error.detail ? (
            <Text align="center" color="faint" testID="provider-error-detail" variant="caption">
              {`Detalle técnico: ${error.detail}`}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  requirement: { flexDirection: "row", gap: 10, alignItems: "center" },
  step: { flexDirection: "row", gap: 12, alignItems: "center" },
  stepNumber: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  centered: { paddingTop: 8 }
});
