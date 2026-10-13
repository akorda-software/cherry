import { MAX_REPORT_DETAILS_LENGTH, REPORT_REASONS, type ReportReason } from "@cherry/contracts";

export interface ReportReasonOption {
  value: ReportReason;
  label: string;
  hint: string;
}

const LABELS: Record<ReportReason, Omit<ReportReasonOption, "value">> = {
  fake_profile: {
    label: "Perfil falso",
    hint: "Fotos de otra persona, suplantación o alguien que no es quien dice ser."
  },
  inappropriate_photos: {
    label: "Fotos inapropiadas",
    hint: "Desnudos, violencia o imágenes que no deberían estar aquí."
  },
  harassment: {
    label: "Acoso o amenazas",
    hint: "Insultos, insistencia, intimidación o cualquier cosa que te haga sentir mal."
  },
  spam: {
    label: "Spam o estafa",
    hint: "Publicidad, enlaces extraños o peticiones de dinero."
  },
  underage: {
    label: "Parece menor de edad",
    hint: "Cherry es solo para mayores de 18 años."
  },
  offensive_bio: {
    label: "Bio ofensiva",
    hint: "Odio, discriminación o lenguaje que hace daño."
  },
  other: {
    label: "Otro motivo",
    hint: "Cuéntanos qué ha pasado en los detalles."
  }
};

export const REPORT_REASON_OPTIONS: readonly ReportReasonOption[] = REPORT_REASONS.map((value) => ({
  value,
  ...LABELS[value]
}));

export function reportReasonLabel(reason: ReportReason): string {
  return LABELS[reason].label;
}

export { MAX_REPORT_DETAILS_LENGTH };

/** Detalles opcionales: sin espacios sobrantes, `undefined` si vacíos y nunca por encima del máximo. */
export function normalizeReportDetails(details: string | null | undefined): string | undefined {
  const trimmed = (details ?? "").trim();

  if (trimmed === "") {
    return undefined;
  }

  return trimmed.slice(0, MAX_REPORT_DETAILS_LENGTH);
}
