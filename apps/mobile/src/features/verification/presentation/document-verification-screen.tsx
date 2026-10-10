import { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { createVerificationApi } from "@cherry/mobile-shared";

import * as DocumentNfc from "../../../../modules/document-nfc";
import {
  Button,
  Icon,
  LoadingDots,
  Mascot,
  Screen,
  Stack,
  Surface,
  Text,
  TextField,
  TopBar
} from "../../../shared/ui";
import { useAuthedApi } from "../../auth/presentation";
import { type DocumentVerificationDeps, useDocumentVerification } from "../application/use-document-verification";
import {
  DATA_SUMMARY,
  holdInstruction,
  READ_STEP_COPY,
  sanitizeCan,
  sanitizeDocumentNumber,
  toMrzDate
} from "../domain/verification-copy";
import { CanLocationArt } from "./can-location-art";

const READ_MESSAGES = {
  prompt: "Acerca la parte de arriba del iPhone a tu documento y no lo muevas.",
  reading: "Leyendo el chip… No lo muevas.",
  success: "Listo."
};

/** Dependencias reales: módulo nativo + `POST /api/me/verification/nfc` con la sesión. */
function useVerificationDeps(): DocumentVerificationDeps {
  const callApi = useAuthedApi(createVerificationApi);

  return useMemo(
    () => ({
      getNfcStatus: DocumentNfc.getNfcStatus,
      readDocument: DocumentNfc.readDocument,
      cancelRead: DocumentNfc.cancelRead,
      openNfcSettings: DocumentNfc.openNfcSettings,
      addReadProgressListener: DocumentNfc.addReadProgressListener,
      verify: (request) => callApi((api) => api.verifyNfc(request)),
      readMessages: READ_MESSAGES
    }),
    [callApi]
  );
}

/**
 * Verificación de edad con el DNI (o pasaporte) por NFC. De momento solo se llega desde la
 * ruta de desarrollo `(dev)/verify-document`; todavía no forma parte del onboarding.
 */
export function DocumentVerificationScreen() {
  const router = useRouter();
  const flow = useDocumentVerification(useVerificationDeps());
  const { phase, kind, step, error } = flow.state;
  const [can, setCan] = useState("");
  const [passport, setPassport] = useState({ number: "", birth: "", expiry: "" });

  const passportKey = useMemo(() => {
    const documentNumber = sanitizeDocumentNumber(passport.number);
    const dateOfBirth = toMrzDate(passport.birth);
    const dateOfExpiry = toMrzDate(passport.expiry);
    return documentNumber && dateOfBirth && dateOfExpiry ? { documentNumber, dateOfBirth, dateOfExpiry } : null;
  }, [passport]);

  const submitKey = useCallback(() => {
    if (kind === "passport") {
      if (passportKey) {
        void flow.submit({ mrz: passportKey });
      }
    } else if (can.length === 6) {
      void flow.submit({ can });
    }
  }, [can, flow, kind, passportKey]);

  const done = useCallback(() => {
    setCan("");
    setPassport({ number: "", birth: "", expiry: "" });
    router.back();
  }, [router]);

  const footer = (() => {
    switch (phase) {
      case "intro":
        return (
          <Button fullWidth onPress={() => void flow.start()} size="lg" testID="verify-start">
            Empezar
          </Button>
        );
      case "key":
        return (
          <Stack gap="sm">
            <Button
              disabled={kind === "passport" ? !passportKey : can.length !== 6}
              fullWidth
              onPress={submitKey}
              size="lg"
              testID="verify-read"
            >
              {kind === "passport" ? "Leer el pasaporte" : "Leer el DNI"}
            </Button>
            <Button
              onPress={() => flow.setKind(kind === "passport" ? "id_card" : "passport")}
              testID="verify-switch-kind"
              variant="ghost"
            >
              {kind === "passport" ? "Usar el DNI" : "Tengo pasaporte"}
            </Button>
          </Stack>
        );
      case "reading":
        return (
          <Button fullWidth onPress={flow.cancel} testID="verify-cancel" variant="secondary">
            Cancelar
          </Button>
        );
      case "success":
        return (
          <Button fullWidth onPress={done} size="lg" testID="verify-done">
            Volver
          </Button>
        );
      case "error":
        return error ? (
          <Stack gap="sm">
            {error.action === "retry" ? (
              <Button fullWidth onPress={flow.retry} size="lg" testID="verify-retry">
                Reintentar
              </Button>
            ) : null}
            {error.action === "edit_key" ? (
              <Button fullWidth onPress={flow.editKey} size="lg" testID="verify-edit-key">
                {kind === "passport" ? "Revisar los datos" : "Cambiar el CAN"}
              </Button>
            ) : null}
            {error.action === "settings" ? (
              <Button fullWidth onPress={flow.openSettings} size="lg" testID="verify-settings">
                Abrir ajustes
              </Button>
            ) : null}
            {error.action === "settings" ? (
              <Button onPress={() => void flow.start()} variant="ghost">
                Ya lo he activado
              </Button>
            ) : (
              <Button onPress={done} variant="ghost">
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
      header={<TopBar left="close" testID="verify-top-bar" title="Comprobar tu edad" />}
      testID="document-verification-screen"
    >
      {phase === "intro" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              Con tu DNI y el NFC del móvil
            </Text>
            <Text color="muted">
              Leemos el chip de tu documento para comprobar que tienes 18 años o más. Tarda unos segundos.
            </Text>
          </Stack>
          {DATA_SUMMARY.map((item) => (
            <View key={item.title} style={styles.row}>
              <Surface color="limonada" elevation="sm" padding="sm" radius="pill" soft border="thin">
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
        </Stack>
      ) : null}

      {phase === "key" && kind === "id_card" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              El número CAN
            </Text>
            <Text color="muted">Está impreso en tu DNI, en la cara de la foto. Sirve para abrir el chip.</Text>
          </Stack>
          <CanLocationArt />
          <TextField
            autoComplete="off"
            inputMode="numeric"
            keyboardType="number-pad"
            label="CAN"
            maxLength={6}
            onChangeText={(value) => setCan(sanitizeCan(value))}
            onSubmitEditing={submitKey}
            placeholder="6 cifras"
            testID="verify-can"
            value={can}
          />
        </Stack>
      ) : null}

      {phase === "key" && kind === "passport" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              Datos del pasaporte
            </Text>
            <Text color="muted">Están en la página de la foto. El chip los usa como contraseña.</Text>
          </Stack>
          <TextField
            autoCapitalize="characters"
            autoComplete="off"
            label="Número del pasaporte"
            onChangeText={(number) => setPassport((current) => ({ ...current, number }))}
            testID="verify-passport-number"
            value={passport.number}
          />
          <TextField
            autoComplete="off"
            hint="DD/MM/AAAA"
            label="Fecha de nacimiento"
            onChangeText={(birth) => setPassport((current) => ({ ...current, birth }))}
            testID="verify-passport-birth"
            value={passport.birth}
          />
          <TextField
            autoComplete="off"
            hint="DD/MM/AAAA"
            label="Fecha de caducidad"
            onChangeText={(expiry) => setPassport((current) => ({ ...current, expiry }))}
            testID="verify-passport-expiry"
            value={passport.expiry}
          />
        </Stack>
      ) : null}

      {phase === "reading" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot animated color="cielo" mood="thinking" size={132} />
          <Text accessibilityRole="header" align="center" variant="title2">
            {kind === "passport" ? "Acerca el pasaporte al móvil" : "Acerca el DNI al móvil"}
          </Text>
          <Text align="center" color="muted">
            {holdInstruction(Platform.OS, kind)}
          </Text>
          <Text accessibilityLiveRegion="polite" align="center" testID="verify-step" variant="label">
            {READ_STEP_COPY[step ?? "waiting"]}
          </Text>
        </Stack>
      ) : null}

      {phase === "sending" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot color="menta" mood="thinking" size={132} />
          <Text accessibilityRole="header" align="center" variant="title2">
            Comprobando la firma del documento
          </Text>
          <LoadingDots />
        </Stack>
      ) : null}

      {phase === "success" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot animated color="menta" mood="celebrate" size={148} />
          <Text accessibilityRole="header" align="center" testID="verify-success" variant="title1">
            Hecho: eres mayor de edad
          </Text>
          <Text align="center" color="muted">
            Hemos guardado solo eso, la fecha y la huella cifrada del documento. Lo demás se ha borrado.
          </Text>
        </Stack>
      ) : null}

      {phase === "error" && error ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <Mascot color="lavanda" mood="sad" size={132} />
          <Text accessibilityRole="header" align="center" testID="verify-error-title" variant="title2">
            {error.title}
          </Text>
          <Text align="center" color="muted">
            {error.message}
          </Text>
          {__DEV__ && error.detail ? (
            <Text align="center" color="faint" testID="verify-error-detail" variant="caption">
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
  centered: { paddingTop: 24 }
});
