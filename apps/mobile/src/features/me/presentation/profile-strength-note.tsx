import { StyleSheet, View } from "react-native";

import { Button, Mascot, type PastelName, StickyNote, Text } from "../../../shared/ui";
import type { MeRoute } from "../domain/me-routes";
import type { ProfileStrength, ProfileStrengthTone } from "../domain/profile-strength";

const noteColor: Record<ProfileStrengthTone, PastelName> = {
  shining: "menta",
  polish: "limonada",
  incomplete: "melocoton"
};

interface ProfileStrengthNoteProps {
  strength: ProfileStrength;
  onNavigate(href: MeRoute): void;
}

/** Nota adhesiva con cómo va tu perfil y, si hace falta, sugerencias concretas (sin culpas). */
export function ProfileStrengthNote({ strength, onNavigate }: ProfileStrengthNoteProps) {
  const shining = strength.tone === "shining";

  return (
    <StickyNote
      color={noteColor[strength.tone]}
      tape={{ color: "fresa", pattern: "dots" }}
      testID="me-strength"
      tilt={1}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.texts}>
            <Text role="heading" variant="title3">
              {strength.title}
            </Text>
            <Text variant="callout">{strength.message}</Text>
          </View>
          {shining ? <Mascot mood="love" size={64} /> : null}
        </View>
        {strength.suggestions.map((suggestion) => (
          <View key={suggestion.id} style={styles.suggestion}>
            <Text variant="body">{suggestion.text}</Text>
            <Button
              onPress={() => onNavigate(suggestion.href)}
              size="sm"
              style={styles.suggestionButton}
              testID={`me-suggestion-${suggestion.id}`}
              variant="secondary"
            >
              {suggestion.actionLabel}
            </Button>
          </View>
        ))}
      </View>
    </StickyNote>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  texts: {
    flex: 1,
    gap: 4
  },
  suggestion: {
    gap: 8
  },
  suggestionButton: {
    alignSelf: "flex-start"
  }
});
