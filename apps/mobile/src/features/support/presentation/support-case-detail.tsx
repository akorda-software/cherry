import type { ReactNode } from "react";
import type { SupportCase } from "@cherry/contracts";
import { Button, Card, FormMessage, Heading, LoadingDots, Screen, Text } from "../../../shared/ui";
import { useSupportCase } from "../application/use-support-case";
import { caseLabels, categoryLabel } from "../domain/support-copy";

export function SupportCaseDetail({
  initial,
  header,
  onAppeal,
  onBack
}: {
  initial: SupportCase;
  header: ReactNode;
  onAppeal(record: SupportCase): void;
  onBack(): void;
}) {
  const detail = useSupportCase(initial);
  const record = detail.record;
  return (
    <Screen header={header} scroll>
      {record ? (
        <>
          <Heading level={2}>
            {caseLabels[record.kind]} · {categoryLabel(record.category)}
          </Heading>
          <Text selectable color="muted">
            Referencia: {record.id}
          </Text>
          <Text>{record.status === "open" ? "Pendiente de respuesta" : "Respuesta del equipo"}</Text>
          {record.statement ? <Text selectable>{record.statement}</Text> : null}
          <Card>
            <Text selectable>
              {record.response ??
                "Hemos recibido tu solicitud. Puedes volver aquí para consultar el estado y la respuesta."}
            </Text>
          </Card>
        </>
      ) : null}
      {detail.loading ? <LoadingDots /> : null}
      {detail.error ? (
        <>
          <FormMessage tone="error">{detail.error}</FormMessage>
          <Button variant="ghost" onPress={() => void detail.refresh()}>
            Actualizar expediente
          </Button>
        </>
      ) : null}
      {record?.canAppeal && !detail.error ? (
        <Button disabled={detail.loading} onPress={() => onAppeal(record)}>
          Pedir revisión humana
        </Button>
      ) : null}
      <Button variant="secondary" onPress={onBack}>
        Volver al buzón
      </Button>
    </Screen>
  );
}
