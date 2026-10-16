import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { MatchSummary } from "@cherry/contracts";

import { Avatar, Badge, Text, useTheme } from "../../../shared/ui";
import { formatRelativeTime, formatRelativeTimeForA11y } from "../../chat/domain/time-format";
import { displayNameOf, lastMessagePreview } from "../domain/match-list";

export interface ConversationRowProps {
  match: MatchSummary;
  now: number;
  onOpen(match: MatchSummary): void;
}

/** Fila de conversación: avatar, nombre, último mensaje («Tú: …»), hora relativa y no leídos. */
export const ConversationRow = memo(function ConversationRow({ match, now, onOpen }: ConversationRowProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const name = displayNameOf(match);
  const unread = match.unreadCount;
  const preview = lastMessagePreview(match);
  const at = match.lastMessage?.insertedAt ?? match.matchedAt;

  const accessibilityLabel = [
    name,
    preview,
    formatRelativeTimeForA11y(at, now),
    unread > 0 ? (unread === 1 ? "1 mensaje sin leer" : `${unread} mensajes sin leer`) : null
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Pressable
      accessibilityHint="Abre la conversación"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => onOpen(match)}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: c.paperDeep } : null]}
      testID={`conversation-${match.id}`}
    >
      {/* Native images retain their previous bitmap while loading; reset only the avatar on recycling. */}
      <Avatar key={match.otherProfile.id} name={name} size="md" uri={match.otherProfile.photoUrl} />
      <View style={styles.texts}>
        <View style={styles.line}>
          <Text numberOfLines={1} style={styles.flex} variant="bodyStrong">
            {name}
          </Text>
          <Text color={unread > 0 ? "accent" : "faint"} maxFontSizeMultiplier={1.3} variant="caption">
            {formatRelativeTime(at, now)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text
            color={unread > 0 ? "default" : "muted"}
            numberOfLines={1}
            style={styles.flex}
            variant={unread > 0 ? "label" : "callout"}
          >
            {preview}
          </Text>
          {unread > 0 ? <Badge count={unread} testID={`conversation-unread-${match.id}`} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  texts: {
    flex: 1,
    gap: 2
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  flex: {
    flex: 1
  }
});
