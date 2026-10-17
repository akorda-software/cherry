import type { CaseKind, PrivacyRequestCategory } from "@cherry/contracts";

export const privacyLabels: Record<PrivacyRequestCategory, string> = {
  access: "Acceder a mis datos",
  rectification: "Corregir mis datos",
  erasure: "Solicitar supresión",
  restriction: "Limitar el tratamiento",
  portability: "Pedir portabilidad",
  objection: "Oponerme al tratamiento"
};
export const caseLabels: Record<CaseKind, string> = {
  report: "Reporte",
  complaint: "Reclamación",
  privacy: "Privacidad",
  appeal: "Recurso",
  measure: "Medida sobre tu cuenta"
};
export function categoryLabel(category: string) {
  return (
    privacyLabels[category as PrivacyRequestCategory] ??
    (
      {
        service: "Servicio",
        safety: "Seguridad",
        other: "Otro motivo",
        harassment: "Acoso",
        spam: "Spam",
        underage: "Posible menor",
        fake_profile: "Perfil falso",
        inappropriate_photos: "Fotos inapropiadas",
        offensive_bio: "Biografía ofensiva"
      } as Record<string, string>
    )[category] ??
    category
  );
}
