import { StyleSheet, View } from "react-native";

import { Button, Mascot, type PastelName, Sparkle, StickyNote, Text } from "../../../shared/ui";
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
            <View style={styles.titleRow}>
              <Text role="heading" style={styles.title} variant="title3">
                {strength.title}
              </Text>
              {/* Destello del sistema (nunca emoji como decoración de interfaz). */}
              {shining ? <Sparkle color="limonada" rotation={8} size={22} /> : null}
            </View>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  title: {
    flexShrink: 1
  },
  suggestion: {
    gap: 8
  },
  suggestionButton: {
    alignSelf: "flex-start"
  }
});
