import { useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  CASE_PAGE_SIZE,
  MAX_CASE_STATEMENT_LENGTH,
  MIN_CASE_STATEMENT_LENGTH,
  PRIVACY_REQUEST_CATEGORIES,
  type PrivacyRequestCategory,
  type SupportCase
} from "@cherry/contracts";
import {
  appShellRoutes,
  Button,
  Card,
  FormMessage,
  Heading,
  LoadingDots,
  Screen,
  Stack,
  Text,
  TextField,
  TopBar,
  useTheme
} from "../../../shared/ui";
import { useSessionShell } from "../../auth/presentation";
import { useSupportInbox } from "../application/use-support-inbox";
import { caseLabels, categoryLabel, privacyLabels } from "../domain/support-copy";
import { SupportCaseDetail } from "./support-case-detail";

export function SupportScreen() {
  const { state } = useSessionShell();
  if (state.status !== "signed-in")
    return (
      <Screen>
        <LoadingDots />
      </Screen>
    );
  // No private drafts, responses or in-flight callbacks survive an account change.
  return <SupportInbox key={state.session.user.id} />;
}

function SupportInbox() {
  const inbox = useSupportInbox();
  const theme = useTheme();
  const [selected, setSelected] = useState<SupportCase | null>(null);
  const [form, setForm] = useState<"complaint" | "privacy" | "appeal" | null>(null);
  const [category, setCategory] = useState<PrivacyRequestCategory>("access");
  const [statement, setStatement] = useState("");
  const [success, setSuccess] = useState(false);
  const current = inbox.page?.cases.find((record) => record.id === selected?.id) ?? selected;
  const header = <TopBar fallbackHref={appShellRoutes.settings} left="back" title="Buzón y privacidad" />;

  function openForm(next: "complaint" | "privacy" | "appeal") {
    setForm(next);
    setStatement("");
    setSuccess(false);
    inbox.clearSendError();
  }

  async function send() {
    const text = statement.trim();
    const saved = await inbox.send(
      form === "appeal" && current
        ? { appealId: current.id, statement: text }
        : form === "privacy"
          ? { kind: "privacy", category, statement: text }
          : { kind: "complaint", category: "service", statement: text }
    );
    if (saved) {
      setStatement("");
      setForm(null);
      setSelected(null);
      setSuccess(true);
    }
  }

  if (form) {
    return (
      <Screen
        header={header}
        scroll
        footer={
          <Button
            disabled={inbox.pending || statement.trim().length < MIN_CASE_STATEMENT_LENGTH}
            loading={inbox.pending}
            onPress={() => void send()}
          >
            Enviar solicitud
          </Button>
        }
      >
        <Heading level={2}>
          {form === "privacy"
            ? "Tus datos, tus derechos"
            : form === "appeal"
              ? "Pedir revisión humana"
              : "Hablar con el equipo"}
        </Heading>
        <Text color="muted">
          No incluyas contraseñas, documentos de identidad ni datos de otras personas. Recibirás aquí la respuesta.
        </Text>
        {form === "privacy" ? (
          <Stack gap="sm">
            {PRIVACY_REQUEST_CATEGORIES.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={category === value ? "primary" : "secondary"}
                disabled={inbox.pending}
                onPress={() => setCategory(value)}
              >
                {privacyLabels[value]}
              </Button>
            ))}
          </Stack>
        ) : null}
        <TextField
          label="Cuéntanos qué necesitas"
          multiline
          value={statement}
          onChangeText={setStatement}
          maxLength={MAX_CASE_STATEMENT_LENGTH}
          editable={!inbox.pending}
        />
        {inbox.sendError ? <FormMessage tone="error">{inbox.sendError}</FormMessage> : null}
        <Button variant="ghost" disabled={inbox.pending} onPress={() => setForm(null)}>
          Cancelar
        </Button>
      </Screen>
    );
  }

  if (current) {
    return (
      <SupportCaseDetail
        key={current.id}
        initial={current}
        header={header}
        onAppeal={(record) => {
          setSelected(record);
          openForm("appeal");
        }}
        onBack={() => {
          setSelected(null);
          void inbox.refresh();
        }}
      />
    );
  }

  return (
    <Screen header={header} padded={false}>
      <FlashList
        data={inbox.page?.cases ?? []}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: theme.semantic.layout.screenPadding, gap: theme.primitives.spacing.md }}
        refreshing={inbox.loading && inbox.page !== null}
        onRefresh={() => void inbox.refresh()}
        ListHeaderComponent={
          <Stack>
            <Text color="muted">
              Tus reportes, reclamaciones y solicitudes de privacidad. Las respuestas no se envían por correo:
              consúltalas en este buzón.
            </Text>
            {success ? <FormMessage tone="success">Solicitud recibida. Ya puedes seguirla aquí.</FormMessage> : null}
            <Button onPress={() => openForm("complaint")}>Nueva reclamación</Button>
            <Button variant="secondary" onPress={() => openForm("privacy")}>
              Ejercer mis derechos de privacidad
            </Button>
            {inbox.error ? (
              <Stack>
                <FormMessage tone="error">{inbox.error}</FormMessage>
                <Button variant="ghost" onPress={() => void inbox.refresh()}>
                  Reintentar carga
                </Button>
              </Stack>
            ) : null}
          </Stack>
        }
        ListEmptyComponent={
          inbox.loading ? (
            <LoadingDots />
          ) : inbox.page && !inbox.error ? (
            <Text color="muted">
              Aún no tienes expedientes en esta página. Puedes abrir una reclamación o solicitar tus derechos de
              privacidad.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Stack gap="sm">
              <Heading level={3}>
                {caseLabels[item.kind]} · {categoryLabel(item.category)}
              </Heading>
              <Text color="muted">{item.status === "open" ? "Pendiente de respuesta" : "Respuesta disponible"}</Text>
              <Button
                size="sm"
                variant="ghost"
                accessibilityLabel={`Abrir expediente ${item.id}`}
                onPress={() => setSelected(item)}
              >
                Consultar expediente
              </Button>
            </Stack>
          </Card>
        )}
        ListFooterComponent={
          <Stack>
            {inbox.page && inbox.page.offset > 0 ? (
              <Button
                variant="ghost"
                disabled={inbox.loading}
                onPress={() => void inbox.loadPage(inbox.page!.offset - CASE_PAGE_SIZE)}
              >
                Página anterior
              </Button>
            ) : null}
            {inbox.page?.cases.length === CASE_PAGE_SIZE && inbox.page.offset < 10000 ? (
              <Button
                variant="ghost"
                disabled={inbox.loading}
                onPress={() => void inbox.loadPage(inbox.page!.offset + CASE_PAGE_SIZE)}
              >
                Página siguiente
              </Button>
            ) : null}
          </Stack>
        }
      />
    </Screen>
  );
}
