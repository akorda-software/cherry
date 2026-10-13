import { memo } from "react";
import { StyleSheet, View } from "react-native";

import type { MatchSummary } from "@cherry/contracts";

import { Avatar, PopIn, PressableScale, Text, useTheme, type PastelName } from "../../../shared/ui";
import { displayNameOf, matchExpiryHint } from "../domain/match-list";

const RINGS: readonly PastelName[] = ["fresa", "menta", "lavanda", "limonada", "cielo", "melocoton"];
export const NEW_MATCH_WIDTH = 92;

export interface NewMatchAvatarProps {
  match: MatchSummary;
  index: number;
  now: number;
  onOpen(match: MatchSummary): void;
}

/**
 * Match nuevo (aún sin mensajes): avatar con aro pastel, nombre y, si queda poco, cuántos días.
 * Entra como una pegatina al aparecer (solo al montarse: la pestaña se queda montada).
 */
export const NewMatchAvatar = memo(function NewMatchAvatar({ match, index, now, onOpen }: NewMatchAvatarProps) {
  const theme = useTheme();
  const name = displayNameOf(match);
  const hint = matchExpiryHint(match.expiresAt, now);
  const label = [
    match.otherProfile.age ? `${name}, ${match.otherProfile.age}` : name,
    "match nuevo",
    hint?.accessibilityLabel ?? null
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <PopIn delay={Math.min(index, 6) * 70} fromScale={0.7} rotate={0}>
      <PressableScale
        accessibilityHint="Abre la conversación"
        accessibilityLabel={label}
        elevation="none"
        faceStyle={styles.face}
        onPress={() => onOpen(match)}
        pressedScale={0.94}
        releaseSpring="pop"
        style={styles.item}
        testID={`new-match-${match.id}`}
      >
        <Avatar name={name} ring={RINGS[index % RINGS.length]} size="lg" uri={match.otherProfile.photoUrl} />
        <View style={styles.texts}>
          <Text align="center" maxFontSizeMultiplier={1.2} numberOfLines={1} variant="label">
            {name}
          </Text>
          {hint ? (
            <Text
              align="center"
              color={theme.semantic.state.warning}
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              variant="caption"
            >
              {hint.short}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    </PopIn>
  );
});

const styles = StyleSheet.create({
  item: {
    width: NEW_MATCH_WIDTH
  },
  face: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 4
  },
  texts: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 0
  }
});
