import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Button, Icon, LoadingDots, Pill, Skeleton, SkeletonGroup, Text, useTheme } from "../../../shared/ui";
import { formatLongDate } from "../domain/time-format";

/** Separador de día: «Hoy», «Ayer», «12 de septiembre». */
export function DaySeparator({ label }: { label: string }) {
  return (
    <View accessibilityRole="header" style={styles.day}>
      <Pill color="white" label={label} size="sm" style={styles.dayPill} />
    </View>
  );
}

/** Tres puntitos en una burbuja suya mientras escribe. */
export function TypingBubble({ name }: { name: string }) {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <Animated.View
      accessibilityLabel={`${name} está escribiendo`}
      accessibilityLiveRegion="polite"
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={styles.typingRow}
      testID="chat-typing"
    >
      <View
        style={[
          styles.typing,
          {
            backgroundColor: c.white,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.regular
          },
          theme.primitives.elevation.sm
        ]}
      >
        <LoadingDots accessibilityLabel={`${name} está escribiendo`} color={c.ink} size={7} />
      </View>
    </Animated.View>
  );
}

export interface HistoryTopProps {
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: boolean;
  matchedAt: string | null;
  hasMessages: boolean;
  onRetry(): void;
}

/** Lo que se ve arriba del todo: cargando historial, reintentar o el comienzo de la conversación. */
export function HistoryTop({ hasOlder, loadingOlder, olderError, matchedAt, hasMessages, onRetry }: HistoryTopProps) {
  const theme = useTheme();

  if (loadingOlder) {
    return (
      <View style={styles.top}>
        <LoadingDots accessibilityLabel="Cargando mensajes anteriores" />
      </View>
    );
  }

  if (olderError && hasOlder) {
    return (
      <View style={styles.top}>
        <Button icon="refresh" onPress={onRetry} size="sm" testID="chat-older-retry" variant="secondary">
          Cargar mensajes anteriores
        </Button>
      </View>
    );
  }

  if (!hasOlder && hasMessages && matchedAt) {
    return (
      <View style={styles.top} testID="chat-start">
        <View style={styles.start}>
          <Icon color={theme.primitives.color.fresaDeep} name="heart-filled" size={16} />
          <Text color="muted" variant="caption">
            Hicisteis match el {formatLongDate(matchedAt)}
          </Text>
        </View>
      </View>
    );
  }

  return <View style={styles.spacer} />;
}

/** Burbujas fantasma mientras llega el historial. */
export function ChatSkeleton() {
  const rows: Array<{ mine: boolean; width: number }> = [
    { mine: false, width: 62 },
    { mine: false, width: 44 },
    { mine: true, width: 56 },
    { mine: false, width: 70 },
    { mine: true, width: 38 },
    { mine: true, width: 64 }
  ];

  return (
    <SkeletonGroup>
      <View
        accessibilityLabel="Cargando la conversación"
        accessibilityRole="progressbar"
        style={styles.skeleton}
        testID="chat-loading"
      >
        {rows.map((row, index) => (
          <View key={index} style={{ alignItems: row.mine ? "flex-end" : "flex-start" }}>
            <Skeleton color={row.mine ? "fresa" : "lavanda"} height={40} radius={18} width={`${row.width}%`} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  day: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 6
  },
  dayPill: {
    alignSelf: "center"
  },
  typingRow: {
    alignSelf: "flex-start",
    paddingTop: 12
  },
  typing: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  top: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    minHeight: 48,
    justifyContent: "center"
  },
  start: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  spacer: {
    height: 12
  },
  skeleton: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 24
  }
});
