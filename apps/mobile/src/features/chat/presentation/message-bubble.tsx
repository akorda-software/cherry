import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp, useReducedMotion } from "react-native-reanimated";

import { easings, HardShadow, Icon, Text, useTheme } from "../../../shared/ui";
import { formatClockTime } from "../domain/time-format";
import type { BubblePosition, TimelineMessage } from "../domain/timeline";

export interface MessageBubbleProps {
  message: TimelineMessage;
  /** Llegó o se envió en vivo: entra con una pequeña animación. */
  live: boolean;
  onRetry(clientId: string): void;
  onDiscard(clientId: string): void;
}

const RADIUS = 18;
const TIGHT = 6;

/** Esquinas: el lado del remitente se estrecha donde la burbuja se junta con otra del grupo. */
function corners(position: BubblePosition, mine: boolean) {
  const joinsOlder = position === "middle" || position === "last";
  const top = joinsOlder ? TIGHT : RADIUS;
  // La esquina inferior del lado del remitente es siempre la «colita».
  const bottom = TIGHT;

  return mine
    ? {
        borderTopLeftRadius: RADIUS,
        borderBottomLeftRadius: RADIUS,
        borderTopRightRadius: top,
        borderBottomRightRadius: bottom
      }
    : {
        borderTopRightRadius: RADIUS,
        borderBottomRightRadius: RADIUS,
        borderTopLeftRadius: top,
        borderBottomLeftRadius: bottom
      };
}

/**
 * Burbuja neobrutal: las mías en fresa, las suyas en blanco; contorno de tinta y sombra dura
 * pequeña. Debajo de la última del grupo, la hora (o «enviando…» / «no se ha podido enviar»).
 */
export const MessageBubble = memo(function MessageBubble({ message, live, onRetry, onDiscard }: MessageBubbleProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const c = theme.primitives.color;
  const { mine, delivery, position } = message;
  const failed = delivery === "failed";
  const sending = delivery === "sending";
  const startsGroup = position === "single" || position === "first";

  const entering = live ? (reduced ? FadeIn.duration(140) : FadeInUp.duration(220).easing(easings.out)) : undefined;

  const bubble = (
    <HardShadow
      elevation="sm"
      style={[
        styles.bubble,
        corners(position, mine),
        {
          backgroundColor: mine ? theme.primitives.pastel.fresa.fill : c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.regular,
          opacity: sending ? 0.78 : 1
        }
      ]}
    >
      <Text selectable style={styles.body} variant="body">
        {message.body}
      </Text>
    </HardShadow>
  );

  return (
    <Animated.View
      entering={entering}
      style={[styles.row, mine ? styles.mine : styles.theirs, { paddingTop: startsGroup ? 12 : 4 }]}
      testID={`message-${message.key}`}
    >
      {failed && message.clientId ? (
        <Pressable
          accessibilityActions={
            message.retryable
              ? [
                  { name: "activate", label: "Reintentar" },
                  { name: "longpress", label: "Borrar el mensaje" }
                ]
              : [{ name: "longpress", label: "Borrar el mensaje" }]
          }
          accessibilityHint={
            message.retryable ? "Toca para reintentar. Mantén pulsado para borrarlo." : "Mantén pulsado para borrarlo."
          }
          accessibilityLabel={`Mensaje sin enviar: ${message.body}`}
          delayLongPress={450}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "longpress") {
              onDiscard(message.clientId!);
            } else if (message.retryable) {
              onRetry(message.clientId!);
            }
          }}
          onLongPress={() => onDiscard(message.clientId!)}
          onPress={() => (message.retryable ? onRetry(message.clientId!) : undefined)}
          style={styles.pressable}
          testID={`message-failed-${message.key}`}
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}

      {failed ? (
        <Pressable
          accessibilityRole="button"
          disabled={!message.retryable}
          hitSlop={12}
          onPress={() => message.clientId && onRetry(message.clientId)}
          style={[styles.meta, mine ? styles.metaMine : null]}
          testID={`message-retry-${message.key}`}
        >
          <Icon color={theme.semantic.state.danger} name="alert" size={16} />
          <Text color="danger" variant="caption">
            {message.retryable ? "No se ha podido enviar · Reintentar" : "No se ha podido enviar"}
          </Text>
        </Pressable>
      ) : sending ? (
        <View style={[styles.meta, mine ? styles.metaMine : null]}>
          <Icon color={c.inkFaint} name="clock" size={14} />
          <Text color="faint" variant="caption">
            Enviando…
          </Text>
        </View>
      ) : message.showTime ? (
        <Text color="faint" style={[styles.time, mine ? styles.timeMine : null]} variant="caption">
          {formatClockTime(message.insertedAt)}
        </Text>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    maxWidth: "80%"
  },
  mine: {
    alignSelf: "flex-end",
    alignItems: "flex-end"
  },
  theirs: {
    alignSelf: "flex-start",
    alignItems: "flex-start"
  },
  pressable: {
    maxWidth: "100%"
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "100%"
  },
  body: {
    flexShrink: 1
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    minHeight: 24
  },
  metaMine: {
    justifyContent: "flex-end"
  },
  time: {
    marginTop: 4,
    marginHorizontal: 4
  },
  timeMine: {
    textAlign: "right"
  }
});
