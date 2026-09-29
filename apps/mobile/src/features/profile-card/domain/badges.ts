import type { IconName } from "../../../shared/ui/art/icon";
import type { ProfilePerson } from "./person";

/**
 * Sistema de insignias pequeño y consistente (contrato de dirección, RAISES):
 * Nuevo · Te ha dado like · En común · Un poco más lejos. Siempre forma + icono + texto,
 * nunca solo color.
 */
export type ProfileBadgeKind = "newcomer" | "likedYou" | "shared" | "farther";

export type BadgeTone = "menta" | "fresa" | "limonada" | "cielo";

export type BadgeIcon = Extract<IconName, "leaf" | "heart-filled" | "sparkles" | "pin">;

export interface ProfileBadge {
  kind: ProfileBadgeKind;
  label: string;
  /** Texto para lectores de pantalla (más explícito que la etiqueta visual). */
  accessibilityLabel: string;
  tone: BadgeTone;
  icon: BadgeIcon;
}

export interface ProfileBadgeOptions {
  /** Oculta «N en común» (p. ej. cuando las etiquetas compartidas ya se ven al lado). */
  includeShared?: boolean;
  /** Oculta «Un poco más lejos» (la distancia ya se muestra con su propia línea). */
  includeFarther?: boolean;
}

export function profileBadges(
  person: Pick<ProfilePerson, "isNewcomer" | "likedYou" | "sharedTagsCount" | "beyondPreferredDistance" | "displayName">,
  { includeShared = true, includeFarther = true }: ProfileBadgeOptions = {}
): ProfileBadge[] {
  const badges: ProfileBadge[] = [];

  if (person.isNewcomer) {
    badges.push({
      kind: "newcomer",
      label: "Nuevo",
      accessibilityLabel: `${person.displayName} acaba de llegar a Snack`,
      tone: "menta",
      icon: "leaf"
    });
  }

  if (person.likedYou) {
    badges.push({
      kind: "likedYou",
      label: "Te ha dado like",
      accessibilityLabel: `${person.displayName} ya te ha dado like: si le das like, es match`,
      tone: "fresa",
      icon: "heart-filled"
    });
  }

  if (includeShared && person.sharedTagsCount > 0) {
    const n = person.sharedTagsCount;
    badges.push({
      kind: "shared",
      label: `${n} en común`,
      accessibilityLabel: n === 1 ? "1 etiqueta en común contigo" : `${n} etiquetas en común contigo`,
      tone: "limonada",
      icon: "sparkles"
    });
  }

  if (includeFarther && person.beyondPreferredDistance) {
    badges.push({
      kind: "farther",
      label: "Un poco más lejos",
      accessibilityLabel: "Está algo más lejos de tu distancia preferida",
      tone: "cielo",
      icon: "pin"
    });
  }

  return badges;
}
