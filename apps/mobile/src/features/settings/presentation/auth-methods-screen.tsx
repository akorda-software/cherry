import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthMethodProvider, AuthMethodsSnapshot } from "@cherry/contracts";
import { createAuthMethodsApi } from "@cherry/mobile-shared";
import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { appShellRoutes, Button, Card, FormMessage, Heading, LoadingDots, Screen, Stack, Text, TopBar } from "../../../shared/ui";
import { useAuthedApi, useSessionShell, useSessionStore } from "../../auth/presentation";
import { defaultAppleAvailability } from "../../auth/presentation/auth-action-list";
import { isAuthCancellation } from "../../auth/presentation/auth-error-copy";
import { executeAuthMethodAction, type AuthMethodAction } from "../application/auth-method-action";

const names = { google: "Google", apple: "Apple" };
const messages: Record<string, string> = {
  identity_in_use: "Ese acceso pertenece a otra cuenta de Cherry. No mezclamos cuentas ni perfiles.",
  provider_already_linked: "Ya tienes otra identidad de ese proveedor vinculada. No la hemos sustituido.",
  last_auth_method: "Necesitas conservar al menos una forma de entrar.",
  reauthentication_required: "Confirma de nuevo la misma cuenta con la que ya entras en Cherry y vuelve a intentarlo.",
  reauth_with_remaining_method: "Para quitar un acceso, confirma tu identidad con el que vas a conservar.",
  apple_reauthentication_required: "Vuelve a entrar con Apple antes de retirarlo, para que podamos revocar su autorización.",
  apple_revocation_pending: "La retirada queda pendiente de la confirmación de Apple. Actualiza los métodos en unos instantes.",
  erasure_protection_unavailable: "No podemos registrar la retirada con seguridad ahora. Inténtalo más tarde."
};

export function AuthMethodsScreen() {
  const { state } = useSessionShell();
  if (state.status !== "signed-in") return <Screen><LoadingDots /></Screen>;
  return <AuthMethodsContent key={state.session.user.id} />;
}

function AuthMethodsContent() {
  const { state } = useSessionShell();
  const callApi = useAuthedApi(createAuthMethodsApi);
  const [snapshot, setSnapshot] = useState<AuthMethodsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [action, setAction] = useState<AuthMethodAction | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const loadId = useRef(0);

  const load = useCallback(async () => {
    const id = ++loadId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await callApi((api) => api.list());
      if (alive.current && id === loadId.current) setSnapshot(next);
    } catch (failure) {
      if (alive.current && id === loadId.current) setError(friendlyErrorMessage(failure, "No hemos podido cargar tus métodos de acceso."));
    } finally {
      if (alive.current && id === loadId.current) setLoading(false);
    }
  }, [callApi]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; loadId.current += 1; };
  }, [load]);

  async function confirm() {
    if (!action || busy.current) return;
    const session = useSessionStore.getState().session;
    const assertCurrentSession = () => {
      const current = useSessionStore.getState();
      if (!alive.current || current.status !== "signed-in" || current.session !== session)
        throw new Error("operation_cancelled");
    };
    busy.current = true;
    setPending(true);
    setError(null);
    setSuccess(null);
    ++loadId.current;
    try {
      const next = await executeAuthMethodAction(action, {
        assertCurrentSession,
        authenticate: (provider) => useSessionStore.getState().services.authProviders[provider].authenticate(),
        submit: (choice, proof) => callApi((api) => api[choice.kind](choice.provider, proof))
      });
      assertCurrentSession();
      setSnapshot(next);
      setSuccess(action.kind === "link"
        ? `${names[action.provider]} ya está vinculado. Puedes entrar con cualquiera de tus métodos.`
        : `${names[action.provider]} se ha retirado. Hemos cerrado tus otras sesiones.`);
      setAction(null);
    } catch (failure) {
      if (alive.current && !isAuthCancellation(failure) && !(failure instanceof Error && failure.message === "operation_cancelled"))
        setError(messages[apiErrorCode(failure) ?? ""] ?? friendlyErrorMessage(failure, "No hemos podido confirmar el cambio. Actualiza los métodos antes de volver a intentarlo."));
    } finally {
      busy.current = false;
      if (alive.current) { setPending(false); setLoading(false); }
    }
  }

  function choose(kind: "link" | "unlink", provider: AuthMethodProvider) {
    const currentProvider = snapshot?.methods.find((method) => method.provider !== provider)?.provider;
    if (!currentProvider) return;
    setError(null);
    setSuccess(null);
    setAction({ kind, provider, currentProvider });
  }

  return (
    <Screen header={<TopBar fallbackHref={appShellRoutes.settings} left="back" title="Métodos de acceso" />} scroll testID="auth-methods-screen">
      {state.status === "signed-in" ? <Text selectable>{`Cuenta actual: ${state.session.user.email}`}</Text> : null}
      <Text>Una sola cuenta y el mismo perfil, entres con Google o con Apple. Tu correo de contacto no cambia.</Text>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {success ? <Text accessibilityLiveRegion="polite">{success}</Text> : null}
      {loading && !snapshot ? <LoadingDots /> : null}
      {!snapshot && !loading ? <Button onPress={() => void load()}>Reintentar</Button> : null}
      {snapshot?.methods.length === 0 ? <Text>No hay métodos vinculados. Cierra sesión y vuelve a entrar con tu proveedor habitual.</Text> : null}
      {snapshot && action ? (
        <Card>
          <Stack gap="md">
            <Heading level={2}>{action.kind === "link" ? "Vincular" : "Quitar"} {names[action.provider]}</Heading>
            <Text>{action.kind === "link"
              ? `Primero confirma tu acceso con ${names[action.currentProvider]} y después con ${names[action.provider]}. No crearemos otra cuenta ni mezclaremos perfiles.`
              : `Confirma tu identidad con ${names[action.currentProvider]}, el método que conservarás. Cerraremos tus otras sesiones. Si retiras Apple, también revocaremos su autorización. Esto no borra tu cuenta; entrar después con el método retirado sin volver a vincularlo podría crear otra cuenta.`}</Text>
            <Button disabled={pending} loading={pending} onPress={() => void confirm()}>
              {pending ? "Confirmando…" : `Confirmar con ${names[action.currentProvider]}`}
            </Button>
            <Button disabled={pending} variant="secondary" onPress={() => { setAction(null); setError(null); }}>Cancelar</Button>
          </Stack>
        </Card>
      ) : snapshot ? (
        <Stack gap="md">
          {(["google", "apple"] as const).map((provider) => {
            const linked = snapshot.methods.find((method) => method.provider === provider);
            const unavailable = !linked && provider === "apple" && defaultAppleAvailability() !== "enabled";
            return <Card key={provider}><Stack gap="sm">
              <Heading level={2}>{names[provider]}</Heading>
              <Text>{linked ? "Vinculado" : unavailable ? "No disponible en esta versión de la app" : "Sin vincular"}</Text>
              <Button variant="secondary" disabled={loading || pending || unavailable || (linked ? !linked.canUnlink : snapshot.methods.length === 0)}
                onPress={() => choose(linked ? "unlink" : "link", provider)}>
                {linked ? `Quitar ${names[provider]}` : `Vincular ${names[provider]}`}
              </Button>
            </Stack></Card>;
          })}
          <Text color="muted">Debes conservar al menos una forma de entrar. Nunca vinculamos cuentas solo porque sus correos coincidan.</Text>
          <Button disabled={pending || loading} variant="secondary" onPress={() => void load()}>Actualizar métodos</Button>
        </Stack>
      ) : null}
    </Screen>
  );
}
