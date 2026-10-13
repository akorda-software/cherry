import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { useRuntimeConfig } from "../../../shared/config";
import {
  appShellRoutes,
  ListRow,
  ListSection,
  LoadingDots,
  Screen,
  Text,
  TopBar,
  useTheme
} from "../../../shared/ui";
import { useAppBootstrap } from "../../app-bootstrap";
import { useLogoutAction, useSessionShell } from "../../auth/presentation";
import { resolveOptionalNavigationEntries } from "../../optional-modules";
import { verificationRoutes } from "../../verification";
import { readAppInfo } from "../infrastructure/app-info";
import { DeleteAccountSheet } from "./delete-account-sheet";
import { useDeleteAccountAction } from "./use-delete-account-action";
import { PAUSED_MESSAGE, useProfilePause } from "./use-profile-pause";
import { useUpdateMyLocation } from "./use-update-location";

/** Ajustes: cuenta, visibilidad, privacidad, acerca de y, al final, la zona de peligro. */
export function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { state } = useSessionShell();
  const logout = useLogoutAction();
  const pause = useProfilePause();
  const location = useUpdateMyLocation();
  const deletion = useDeleteAccountAction();
  const optionalEntries = useOptionalModuleEntries();
  const appInfo = useMemo(() => readAppInfo(), []);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { state: bootstrapState } = useAppBootstrap();
  const ageVerification = bootstrapState.status === "ready" ? bootstrapState.bootstrap.ageVerification : undefined;

  const email = state.status === "signed-in" ? state.session.user.email : null;

  async function signOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  function closeDelete() {
    if (!deletion.pending) {
      setDeleteOpen(false);
      deletion.clearError();
    }
  }

  return (
    <Screen
      header={<TopBar fallbackHref={appShellRoutes.me} left="back" title="Ajustes" />}
      scroll
      testID="settings-screen"
    >
      <ListSection title="Cuenta">
        <ListRow
          description={email ?? "Sin sesión"}
          icon="mail"
          iconColor="cielo"
          label="Tu correo"
          testID="settings-email"
        />
        <ListRow
          disabled={signingOut}
          icon="logout"
          iconColor="melocoton"
          label="Cerrar sesión"
          onPress={() => void signOut()}
          testID="settings-logout"
          trailing={signingOut ? <LoadingDots color={theme.primitives.color.ink} /> : "none"}
        />
      </ListSection>

      <ListSection footnote="Tomarte un respiro está bien." title="Visibilidad">
        <ListRow
          description={
            pause.isPaused
              ? PAUSED_MESSAGE
              : "Dejas de salir en Descubrir y en Likes. Tus chats siguen aquí."
          }
          disabled={pause.pending}
          icon="moon"
          iconColor="lavanda"
          label="Pausar mi perfil"
          onSwitchChange={(next) => void pause.toggle(next)}
          switchValue={pause.isPaused}
          testID="settings-pause"
        />
      </ListSection>

      <ListSection
        footnote="Para bloquear o reportar a alguien, abre su perfil o vuestro chat y toca ⋯. Si bloqueas, dejáis de veros del todo y no le avisamos; los reportes son anónimos."
        title="Privacidad y seguridad"
      >
        <ListRow
          accessibilityHint={location.blocked ? "Abre los ajustes del sistema" : undefined}
          description={
            location.blocked
              ? "Cherry no tiene permiso de ubicación. Actívalo en Ajustes y vuelve: la actualizamos sola."
              : "Se actualiza sola al abrir la app, redondeada a 500 m (nunca la exacta). Tócalo si te acabas de mudar."
          }
          disabled={location.pending}
          icon={location.blocked ? "gear" : "pin"}
          iconColor="menta"
          label={location.blocked ? "Activar la ubicación en Ajustes" : "Actualizar mi ubicación"}
          onPress={location.run}
          testID="settings-update-location"
          trailing={location.pending ? <LoadingDots color={theme.primitives.color.ink} /> : "none"}
        />
      </ListSection>

      {optionalEntries.length > 0 ? (
        <ListSection title="Más">
          {optionalEntries.map((entry) => (
            <ListRow key={entry.href} label={entry.label} onPress={() => router.push(entry.href)} />
          ))}
        </ListSection>
      ) : null}

      <ListSection title="Cherry">
        <ListRow
          description="Privacidad, licencia y versión"
          icon="heart"
          iconColor="fresa"
          label="Acerca de Cherry"
          onPress={() => router.push(appShellRoutes.about)}
          testID="settings-about"
        />
      </ListSection>

      {ageVerification?.required || ageVerification?.status === "verified" ? (
        <ListSection title="Edad">
          <ListRow
            description={
              ageVerification.status === "verified"
                ? "Comprobada con tu documento."
                : "Pendiente. Tu perfil no se activa hasta que la compruebes."
            }
            icon="shield-check"
            iconColor="menta"
            label="Comprobar mi edad"
            onPress={ageVerification.status === "verified" ? undefined : () => router.push(verificationRoutes.intro)}
            testID="settings-verify-age"
          />
        </ListSection>
      ) : null}

      <ListSection title="Zona de peligro">
        <ListRow
          danger
          description="Desactiva tu cuenta y oculta tu perfil. No se puede deshacer."
          icon="trash"
          label="Borrar cuenta"
          onPress={() => setDeleteOpen(true)}
          testID="settings-delete"
        />
      </ListSection>

      {appInfo.version ? (
        <Text align="center" color="faint" style={styles.version} testID="settings-version" variant="caption">
          {`Cherry · versión ${appInfo.version}`}
        </Text>
      ) : null}

      <DeleteAccountSheet
        error={deletion.error}
        onClose={closeDelete}
        onConfirm={() => void deletion.run()}
        pending={deletion.pending}
        visible={deleteOpen}
      />
    </Screen>
  );
}

/** Entradas de módulos opcionales (registro de `optional-modules`), según sesión y flags. */
function useOptionalModuleEntries() {
  const { state } = useSessionShell();
  const { bootstrapConfig } = useRuntimeConfig();

  return useMemo(() => {
    const features = Object.fromEntries(
      Object.entries(bootstrapConfig?.features ?? {}).map(([key, flag]) => [key, flag.enabled])
    );

    return resolveOptionalNavigationEntries({
      session: state.status === "signed-in" ? state.session : null,
      features
    });
  }, [bootstrapConfig, state]);
}

const styles = StyleSheet.create({
  version: {
    marginTop: -4
  }
});
