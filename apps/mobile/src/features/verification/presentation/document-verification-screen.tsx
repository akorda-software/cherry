import { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { createVerificationApi } from "@cherry/mobile-shared";

import * as DocumentNfc from "../../../../modules/document-nfc";
import {
  appShellRoutes,
  Button,
  Icon,
  LoadingDots,
  Mascot,
  ProgressBar,
  Screen,
  Stack,
  Surface,
  Text,
  TextField,
  TopBar
} from "../../../shared/ui";
import { refreshBootstrap } from "../../app-bootstrap";
import { useAuthedApi, useLogoutAction } from "../../auth/presentation";
import { type DocumentVerificationDeps, useDocumentVerification } from "../application/use-document-verification";
import {
  DATA_SUMMARY,
  holdInstruction,
  NFC_REQUIREMENTS,
  placementSteps,
  READ_STEP_COPY,
  READ_STEP_PROGRESS,
  sanitizeCan,
  sanitizeDocumentNumber,
  toMrzDate
} from "../domain/verification-copy";
import { CanLocationArt } from "./can-location-art";
import { NfcPlacementArt } from "./nfc-placement-art";

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
      readMessages: READ_MESSAGES,
      // Activa el perfil: el bootstrap deja de estar «pendiente de verificar».
      onVerified: refreshBootstrap
    }),
    [callApi]
  );
}

/**
 * Verificación de edad con el DNI (o pasaporte) por NFC, paso a paso: qué hace falta → CAN →
 * cómo colocarlo → lectura → resultado. Se llega desde «Comprobar tu edad» (`/verify`).
 *
 * Lo normal es una tarjeta con CAN (DNI, TIE y casi todos los documentos de identidad europeos).
 * Los casos raros quedan a un toque: «Tengo pasaporte» y «Mi documento no tiene CAN», que abren el
 * chip con los datos de la MRZ; si el CAN falla, el error también ofrece probar con esos datos.
 */
export function DocumentVerificationScreen() {
  const router = useRouter();
  const logout = useLogoutAction();
  const flow = useDocumentVerification(useVerificationDeps());
  const { phase, kind, access, step, error } = flow.state;
  const [can, setCan] = useState("");
  const [mrz, setMrz] = useState({ number: "", birth: "", expiry: "" });
  const isPassport = kind === "passport";

  const mrzKey = useMemo(() => {
    const documentNumber = sanitizeDocumentNumber(mrz.number);
    const dateOfBirth = toMrzDate(mrz.birth);
    const dateOfExpiry = toMrzDate(mrz.expiry);
    return documentNumber && dateOfBirth && dateOfExpiry ? { documentNumber, dateOfBirth, dateOfExpiry } : null;
  }, [mrz]);

  const submitKey = useCallback(() => {
    if (access === "mrz") {
      if (mrzKey) {
        void flow.submit({ mrz: mrzKey });
      }
    } else if (can.length === 6) {
      void flow.submit({ can });
    }
  }, [access, can, flow, mrzKey]);

  const useMrzData = useCallback(() => {
    flow.setAccess("mrz");
    flow.editKey();
  }, [flow]);

  const clear = useCallback(() => {
    setCan("");
    setMrz({ number: "", birth: "", expiry: "" });
  }, []);

  const keyLabel = access === "mrz" ? "Revisar los datos" : "Cambiar el CAN";

  const done = useCallback(() => {
    clear();
    router.back();
  }, [clear, router]);

  const finish = useCallback(() => {
    clear();
    router.replace(appShellRoutes.discover);
  }, [clear, router]);

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
              disabled={access === "mrz" ? !mrzKey : can.length !== 6}
              fullWidth
              onPress={submitKey}
              size="lg"
              testID="verify-read"
            >
              Continuar
            </Button>
            {isPassport ? null : (
              <Button
                onPress={() => flow.setAccess(access === "mrz" ? "can" : "mrz")}
                testID="verify-switch-access"
                variant="ghost"
              >
                {access === "mrz" ? "Usar el CAN" : "Mi documento no tiene CAN"}
              </Button>
            )}
            <Button
              onPress={() => flow.setKind(isPassport ? "id_card" : "passport")}
              testID="verify-switch-kind"
              variant="ghost"
            >
              {isPassport ? "Usar el DNI u otro documento de identidad" : "Tengo pasaporte"}
            </Button>
          </Stack>
        );
      case "guide":
        return (
          <Stack gap="sm">
            <Button fullWidth icon="play" onPress={() => void flow.beginRead()} size="lg" testID="verify-begin-read">
              Empezar a leer
            </Button>
            <Button onPress={flow.editKey} testID="verify-back-to-key" variant="ghost">
              {keyLabel}
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
          <Button fullWidth onPress={finish} size="lg" testID="verify-done">
            Empezar a usar Cherry
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
                {keyLabel}
              </Button>
            ) : null}
            {error.offerMrz ? (
              <Button
                fullWidth
                onPress={useMrzData}
                size="lg"
                testID="verify-use-mrz"
                variant={error.action === "edit_key" ? "secondary" : "primary"}
              >
                Probar con los datos del documento
              </Button>
            ) : null}
            {error.action === "settings" ? (
              <Button fullWidth onPress={flow.openSettings} size="lg" testID="verify-settings">
                Abrir ajustes
              </Button>
            ) : null}
            {error.action === "sign_out" ? (
              <Button fullWidth onPress={() => void logout()} size="lg" testID="verify-sign-out">
                Salir
              </Button>
            ) : error.action === "settings" ? (
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
      scroll
      testID="document-verification-screen"
    >
      {phase === "intro" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              Con tu DNI y el NFC del móvil
            </Text>
            <Text color="muted">
              Leemos el chip de tu documento para comprobar que tienes 18 años o más. Tarda menos de un minuto.
            </Text>
          </Stack>
          <Surface color="limonada" padding="md" radius="lg" soft>
            <Stack gap="sm">
              <Text variant="bodyStrong">Qué necesitas</Text>
              {NFC_REQUIREMENTS.map((item) => (
                <View key={item.text} style={styles.requirement}>
                  <Icon name={item.icon} size={18} />
                  <Text style={styles.flex} variant="callout">
                    {item.text}
                  </Text>
                </View>
              ))}
            </Stack>
          </Surface>
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

      {phase === "key" && !isPassport && access === "can" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              El número CAN
            </Text>
            <Text color="muted">
              Son 6 cifras impresas en la cara de la foto y sirven para abrir el chip. En otros documentos de identidad
              suele llevar al lado la palabra CAN.
            </Text>
          </Stack>
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
          <CanLocationArt />
        </Stack>
      ) : null}

      {phase === "key" && access === "mrz" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              {isPassport ? "Datos del pasaporte" : "Datos del documento"}
            </Text>
            <Text color="muted">
              {isPassport
                ? "Están en la página de la foto. El chip los usa como contraseña."
                : "Están en las líneas de letras y números de la tarjeta, normalmente en el reverso. El chip los usa como contraseña."}
            </Text>
          </Stack>
          <TextField
            autoCapitalize="characters"
            autoComplete="off"
            hint={isPassport ? undefined : "El de la tarjeta, no tu número personal"}
            label={isPassport ? "Número del pasaporte" : "Número del documento"}
            onChangeText={(number) => setMrz((current) => ({ ...current, number }))}
            testID="verify-passport-number"
            value={mrz.number}
          />
          <TextField
            autoComplete="off"
            hint="DD/MM/AAAA"
            label="Fecha de nacimiento"
            onChangeText={(birth) => setMrz((current) => ({ ...current, birth }))}
            testID="verify-passport-birth"
            value={mrz.birth}
          />
          <TextField
            autoComplete="off"
            hint="DD/MM/AAAA"
            label="Fecha de caducidad"
            onChangeText={(expiry) => setMrz((current) => ({ ...current, expiry }))}
            testID="verify-passport-expiry"
            value={mrz.expiry}
          />
        </Stack>
      ) : null}

      {phase === "guide" ? (
        <Stack gap="lg">
          <Stack gap="sm">
            <Text accessibilityRole="header" variant="title1">
              Cómo colocarlo
            </Text>
            <Text color="muted">El chip está dentro de la tarjeta y el lector del móvil, junto a la cámara.</Text>
          </Stack>
          <NfcPlacementArt mode="guide" />
          <Stack gap="sm" testID="verify-guide-steps">
            {placementSteps(Platform.OS, kind).map((text, index) => (
              <View key={text} style={styles.step}>
                <Surface color="cielo" elevation="sm" padding={0} radius="pill" border="thin" style={styles.stepNumber}>
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
        </Stack>
      ) : null}

      {phase === "reading" ? (
        <Stack align="center" gap="lg" style={styles.centered}>
          <NfcPlacementArt mode="reading" />
          <Text accessibilityRole="header" align="center" variant="title2">
            {step === "waiting" || step === null
              ? isPassport
                ? "Acerca el pasaporte al móvil"
                : access === "mrz"
                  ? "Acerca el documento al móvil"
                  : "Acerca el DNI al móvil"
              : "No lo muevas"}
          </Text>
          <Text align="center" color="muted">
            {holdInstruction(Platform.OS, kind)}
          </Text>
          <ProgressBar
            accessibilityLabel="Progreso de la lectura"
            color={step === "retrying" ? "melocoton" : "menta"}
            style={styles.progress}
            testID="verify-progress"
            value={READ_STEP_PROGRESS[step ?? "waiting"]}
          />
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
            Listo: tu perfil ya está activo
          </Text>
          <Text align="center" color="muted">
            Hemos guardado solo que eres mayor de edad, la fecha y la huella cifrada del documento. Lo demás se ha
            borrado.
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
  requirement: { flexDirection: "row", gap: 10, alignItems: "center" },
  step: { flexDirection: "row", gap: 12, alignItems: "center" },
  stepNumber: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  progress: { alignSelf: "stretch" },
  flex: { flex: 1 },
  centered: { paddingTop: 8 }
});
