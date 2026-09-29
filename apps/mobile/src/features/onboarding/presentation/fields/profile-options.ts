import type { Gender, RelationshipIntent } from "@snack/contracts";

import type { IconName } from "../../../../shared/ui";
import type { InterestedIn } from "../../domain/preferences";

export interface ProfileOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
}

export const GENDER_OPTIONS: ReadonlyArray<ProfileOption<Gender>> = [
  { value: "man", label: "Hombre" },
  { value: "woman", label: "Mujer" },
  { value: "non_binary", label: "No binario" }
];

export const INTERESTED_OPTIONS: ReadonlyArray<ProfileOption<InterestedIn>> = [
  { value: "women", label: "Mujeres" },
  { value: "men", label: "Hombres" },
  { value: "non_binary", label: "Personas no binarias" }
];

export const INTENT_OPTIONS: ReadonlyArray<ProfileOption<RelationshipIntent>> = [
  { value: "relationship", label: "Relación", description: "Alguien con quien construir algo bonito.", icon: "heart" },
  { value: "casual", label: "Algo casual", description: "Pasarlo bien, sin compromisos.", icon: "sparkles" },
  { value: "meet_people", label: "Conocer gente", description: "Planes, amistades y lo que surja.", icon: "users" },
  {
    value: "go_with_the_flow",
    label: "A ver qué pasa",
    description: "Sin plan fijo: encaja con todas las demás.",
    icon: "smile"
  }
];

export function optionLabel<T extends string>(options: ReadonlyArray<ProfileOption<T>>, value: T | null | undefined): string | null {
  return options.find((option) => option.value === value)?.label ?? null;
}
