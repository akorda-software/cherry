import type { IconName } from "../../../shared/ui/art/icon";

/**
 * Intención («qué busca») de OTRA persona, contada en su voz y en tuteo.
 * Los valores vienen del contrato (`RelationshipIntent`), pero se aceptan cadenas
 * desconocidas para no romper con intenciones futuras.
 */
export type IntentKey = "relationship" | "casual" | "meet_people" | "go_with_the_flow";

export type IntentIcon = Extract<IconName, "heart" | "sparkle" | "users" | "smile">;

export type IntentTone = "fresa" | "melocoton" | "cielo" | "lavanda";

export interface IntentDescriptor {
  key: IntentKey | "unknown";
  /** Texto corto de la insignia. */
  label: string;
  /** Frase completa para el perfil y lectores de pantalla. */
  sentence: string;
  icon: IntentIcon;
  tone: IntentTone;
}

const INTENTS: Record<IntentKey, IntentDescriptor> = {
  relationship: {
    key: "relationship",
    label: "Busca pareja",
    sentence: "Busca una relación",
    icon: "heart",
    tone: "fresa"
  },
  casual: {
    key: "casual",
    label: "Algo casual",
    sentence: "Busca algo casual",
    icon: "sparkle",
    tone: "melocoton"
  },
  meet_people: {
    key: "meet_people",
    label: "Conocer gente",
    sentence: "Quiere conocer gente",
    icon: "users",
    tone: "cielo"
  },
  go_with_the_flow: {
    key: "go_with_the_flow",
    label: "A ver qué pasa",
    sentence: "A ver qué pasa, sin prisas",
    icon: "smile",
    tone: "lavanda"
  }
};

export function describeIntent(value: string | null | undefined): IntentDescriptor | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    INTENTS[value as IntentKey] ?? {
      key: "unknown",
      label: value,
      sentence: value,
      icon: "sparkle",
      tone: "lavanda"
    }
  );
}
