import { memo, useMemo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { Icon, Stack, Text, useTheme } from "../../../shared/ui";
import { type PersonSource, toProfilePerson } from "../domain/person";
import { BioNote } from "./bio-note";
import { IntentBadge } from "./intent-badge";
import { NameSticker } from "./name-sticker";
import { ProfileBadges } from "./profile-badges";
import { TagCloud, TagStickerRow } from "./tag-cloud";

export interface ProfileSummaryProps {
  profile: PersonSource;
  /**
   * `feed`: insignias, qué busca y distancia, etiquetas en común destacadas y la bio (recortada).
   * `full`: todo, con las etiquetas agrupadas («En común» primero y luego por categoría).
   */
  variant?: "feed" | "full";
  /** Pinta la pegatina con el nombre (si el contenedor no la coloca él mismo sobre la foto). */
  showName?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Bloque de información de una persona (debajo de sus fotos), para el feed y el perfil completo. */
export const ProfileSummary = memo(function ProfileSummary({
  profile,
  variant = "feed",
  showName = false,
  style,
  testID
}: ProfileSummaryProps) {
  const person = useMemo(() => toProfilePerson(profile), [profile]);
  const full = variant === "full";

  return (
    <Stack gap={full ? "lg" : "md"} style={style} testID={testID}>
      {showName ? <NameSticker age={person.age} name={person.displayName} size={full ? "lg" : "md"} /> : null}
      <ProfileBadges includeShared={!full} person={person} size={full ? "md" : "sm"} testID={testID ? `${testID}-badges` : undefined} />
      <MetaLine distanceLabel={person.distanceLabel} intent={person.whatIAmLookingFor} sentence={full} />
      {full ? null : <TagStickerRow limit={4} size="sm" tags={person.tags} />}
      <BioNote bio={person.bio} numberOfLines={full ? undefined : 3} tilt={full ? -1 : -1.5} />
      {full ? <TagCloud animateShared layout="grouped" tags={person.tags} testID={testID ? `${testID}-tags` : undefined} /> : null}
    </Stack>
  );
});

export function MetaLine({
  intent,
  distanceLabel,
  sentence = false
}: {
  intent: string | null;
  distanceLabel: string | null;
  sentence?: boolean;
}) {
  const theme = useTheme();

  if (!intent && !distanceLabel) {
    return null;
  }

  return (
    <View style={styles.meta}>
      <IntentBadge intent={intent} sentence={sentence} size="sm" />
      {distanceLabel ? (
        <View accessibilityLabel={distanceLabel} accessibilityRole="text" accessible style={styles.distance}>
          <Icon color={theme.semantic.icon.muted} name="pin" size={16} />
          <Text color="muted" maxFontSizeMultiplier={1.3} numberOfLines={1} variant="caption">
            {distanceLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6
  },
  distance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1
  }
});
