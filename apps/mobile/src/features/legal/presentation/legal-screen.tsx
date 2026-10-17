import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { appShellRoutes, Button, ErrorState, FormMessage, Screen, Surface, Text, TopBar } from "../../../shared/ui";
import { refreshBootstrap } from "../../app-bootstrap";
import { useAuthedApi, useLogoutAction, useSessionShell } from "../../auth/presentation";
import { DeleteAccountSheet } from "../../settings/presentation/delete-account-sheet";
import { useDeleteAccountAction } from "../../settings/presentation/use-delete-account-action";
import { canAccept, emptyDeclarations, type LegalDeclarations, type LegalPublication } from "../domain/legal";
import { createLegalApi } from "../infrastructure/legal-api";

type PublicationState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; publication: LegalPublication; accepted: boolean };

/** SDK 54: reuse the existing UI system; no new native dependency or binary. */
export function LegalScreen({ gate = false }: { gate?: boolean }) {
  const router = useRouter();
  const callApi = useAuthedApi(createLegalApi);
  const { state: session } = useSessionShell();
  const logout = useLogoutAction();
  const deletion = useDeleteAccountAction();
  const [state, setState] = useState<PublicationState>({ status: "loading" });
  const [declarations, setDeclarations] = useState(emptyDeclarations);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") {
      setState({ status: "loading" });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    setDeclarations({ ...emptyDeclarations });
    setError(null);
    void callApi((api) => api.get()).then(
      ({ publication, status }) => {
        if (active) setState({ status: "ready", publication, accepted: status.accepted });
      },
      () => { if (active) setState({ status: "error" }); }
    );
    return () => { active = false; };
  }, [callApi, attempt, session.status]);

  async function accept() {
    if (saving.current || deletion.pending || state.status !== "ready" || !canAccept(state.publication, declarations)) return;
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      await callApi((api) => api.accept(state.publication, declarations));
      if (mounted.current) setState({ ...state, accepted: true });
      await refreshBootstrap();
    } catch (cause) {
      if (mounted.current) {
        setError((cause as { code?: string }).code === "policy_changed"
          ? "Los textos han cambiado. Recárgalos y revisa la nueva versión antes de decidir."
          : "No hemos podido guardar tu decisión. No la damos por aceptada; puedes reintentar.");
      }
    } finally {
      saving.current = false;
      if (mounted.current) setPending(false);
    }
  }

  const header = <TopBar title="Privacidad y decisiones" left={gate ? undefined : "back"} fallbackHref={appShellRoutes.settings} />;
  const rights = <>
    <Text>El consentimiento sensible puede retirarse. Como Cherry es un servicio de citas, la opción actual es retirar y borrar la cuenta: dejarás de usar el servicio y se borrarán también tus conversaciones compartidas. No afecta a la licitud del tratamiento anterior. Puedes contactar sin sesión o usar el buzón sin aceptar textos nuevos.</Text>
    <Button variant="secondary" disabled={pending || deletion.pending} onPress={() => router.push(appShellRoutes.support)}>Buzón y derechos</Button>
    <Button variant="danger" disabled={pending || deletion.pending} onPress={() => setDeleteOpen(true)}>Retirar y borrar mi cuenta</Button>
    <Button variant="ghost" disabled={pending || deletion.pending} onPress={() => void logout()}>Salir sin aceptar</Button>
    <DeleteAccountSheet visible={deleteOpen} pending={deletion.pending} error={deletion.error} onConfirm={() => void deletion.run()} onClose={() => { if (!deletion.pending) setDeleteOpen(false); }} />
  </>;

  if (state.status === "loading") return <Screen header={header} scroll testID="legal-loading"><Text>Cargando los textos de esta instancia…</Text>{rights}</Screen>;
  if (state.status === "error") return <Screen header={header} scroll><ErrorState message="No hemos podido cargar los textos. No se ha registrado ninguna aceptación." onRetry={() => setAttempt((n) => n + 1)} />{rights}</Screen>;

  const { publication, accepted } = state;
  return (
    <Screen header={header} scroll testID="legal-screen">
      <Text variant="title2">Antes de compartir tu perfil</Text>
      <Text>Lee la información de esta instancia y decide por separado. No pedimos que «aceptes la privacidad»: te informamos de cómo tratamos los datos.</Text>
      <Text selectable variant="caption">{`Versión ${publication.version}`}</Text>
      {!publication.ready ? <FormMessage tone="error">Textos preparatorios: faltan datos o aprobación del titular. Todavía no se pueden aceptar.</FormMessage> : null}
      {publication.documents.length === 0 ? <FormMessage tone="error">No hay documentos disponibles. No puedes aceptar una publicación vacía.</FormMessage> : null}
      {publication.documents.map((document) => (
        <Surface key={document.slug} padding="md" radius="lg">
          <Button variant="ghost" accessibilityHint="Muestra u oculta el texto completo de esta versión" onPress={() => setExpanded(expanded === document.slug ? null : document.slug)}>{document.title}</Button>
          {expanded === document.slug ? <View style={{ gap: 12 }}>
            <Text selectable>{document.intro}</Text>
            {document.sections.map(([heading, content]) => <View key={heading} style={{ gap: 4 }}>
              <Text role="heading" variant="title3">{heading}</Text><Text selectable>{content}</Text>
            </View>)}
          </View> : null}
        </Surface>
      ))}
      {accepted ? <>
        <Text>Esta cuenta ya tiene registrada su decisión para esta publicación. No se conserva tu IP como prueba de consentimiento.</Text>
        {gate ? <Button onPress={() => void refreshBootstrap()}>Continuar</Button> : null}
      </> : <>
        <Declaration name="termsAccepted" label={publication.termsText} value={declarations.termsAccepted} disabled={pending} onChange={setDeclarations} />
        <Declaration name="adulthoodConfirmed" label={publication.adulthoodText} value={declarations.adulthoodConfirmed} disabled={pending} onChange={setDeclarations} />
        <Declaration name="sensitiveConsent" label={publication.sensitiveText} value={declarations.sensitiveConsent} disabled={pending} onChange={setDeclarations} />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button disabled={!canAccept(publication, declarations)} loading={pending} onPress={() => void accept()} testID="legal-accept">Guardar mis decisiones</Button>
        <Button variant="ghost" disabled={pending} onPress={() => setAttempt((n) => n + 1)}>Recargar textos</Button>
      </>}
      {rights}
    </Screen>
  );
}

function Declaration({ name, label, value, disabled, onChange }: {
  name: keyof LegalDeclarations;
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: React.Dispatch<React.SetStateAction<LegalDeclarations>>;
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange((current) => ({ ...current, [name]: !current[name] }))} style={{ padding: 16, minHeight: 48 }} testID={`legal-${name}`}>
    <Text>{`${value ? "☑" : "☐"} ${label}`}</Text>
  </Pressable>;
}
