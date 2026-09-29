import { memo, useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { Inline, Pill } from "../../../shared/ui";
import { type ProfileBadgeOptions, profileBadges } from "../domain/badges";
import type { ProfilePerson } from "../domain/person";

export interface ProfileBadgesProps extends ProfileBadgeOptions {
  person: Pick<ProfilePerson, "isNewcomer" | "likedYou" | "sharedTagsCount" | "beyondPreferredDistance" | "displayName">;
  size?: "sm" | "md";
  /** Máximo de insignias (las más importantes primero). */
  limit?: number;
  /** Fila sin saltos de línea (cards apretadas). */
  singleLine?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Insignias del sistema (Nuevo · Te ha dado like · N en común · Un poco más lejos): forma + icono + texto. */
export const ProfileBadges = memo(function ProfileBadges({
  person,
  size = "sm",
  limit,
  singleLine = false,
  includeShared,
  includeFarther,
  style,
  testID
}: ProfileBadgesProps) {
  const badges = useMemo(
    () => profileBadges(person, { includeShared, includeFarther }).slice(0, limit ?? undefined),
    [includeFarther, includeShared, limit, person]
  );

  if (badges.length === 0) {
    return null;
  }

  return (
    <Inline gap="xs" style={style} testID={testID} wrap={!singleLine}>
      {badges.map((badge) => (
        <Pill
          key={badge.kind}
          accessibilityLabel={badge.accessibilityLabel}
          color={badge.tone}
          icon={badge.icon}
          label={badge.label}
          size={size}
          testID={testID ? `${testID}-${badge.kind}` : undefined}
        />
      ))}
    </Inline>
  );
});
