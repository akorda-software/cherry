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
   * `full`: todo, con las etiquetas agrupadas («En común» primero y luego por categoría)
   *   arriba del todo, antes de qué busca, la distancia y la bio.
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
      {/* En el perfil completo las etiquetas (las comunes primero, con destello) van justo
          bajo el nombre: son lo que más os une y lo primero que se busca. */}
      {full ? <TagCloud animateShared layout="grouped" tags={person.tags} testID={testID ? `${testID}-tags` : undefined} /> : null}
      <ProfileBadges includeShared={!full} person={person} size={full ? "md" : "sm"} testID={testID ? `${testID}-badges` : undefined} />
      <MetaLine distanceLabel={person.distanceLabel} intents={person.lookingFor} sentence={full} />
      {full ? null : <TagStickerRow limit={4} size="sm" tags={person.tags} />}
      <BioNote bio={person.bio} numberOfLines={full ? undefined : 3} tilt={full ? -1 : -1.5} />
    </Stack>
  );
});

export function MetaLine({
  intents,
  distanceLabel,
  sentence = false
}: {
  /** `lookingFor` de la persona. */
  intents: ReadonlyArray<string>;
  distanceLabel: string | null;
  sentence?: boolean;
}) {
  const theme = useTheme();

  if (intents.length === 0 && !distanceLabel) {
    return null;
  }

  return (
    <View style={styles.meta}>
      <IntentBadge intents={intents} sentence={sentence} size="sm" />
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
