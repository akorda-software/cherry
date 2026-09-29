import type { StyleProp, ViewStyle } from "react-native";

import type { MascotMood } from "../art";
import { Button } from "../primitives/button";
import { EmptyState } from "./empty-state";

export interface ErrorStateProps {
  /** Qué ha pasado, en palabras de persona. */
  message: string;
  title?: string;
  onRetry?(): void;
  retryLabel?: string;
  /** Reintento en curso (el botón muestra puntitos). */
  retrying?: boolean;
  mood?: MascotMood;
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}


/** Error recuperable: qué pasó + reintentar. Sin culpas ni tecnicismos. */
export function ErrorState({
  message,
  title = "Vaya, algo se ha torcido",
  onRetry,
  retryLabel = "Reintentar",
  retrying = false,
  mood = "sad",
  compact,
  testID,
  style
}: ErrorStateProps) {
  return (
    <EmptyState
      action={
        onRetry ? (
          <Button icon="refresh" loading={retrying} onPress={onRetry} testID={testID ? `${testID}-retry` : undefined}>
            {retryLabel}
          </Button>
        ) : undefined
      }
      compact={compact}
      description={message}
      mascotColor="lavanda"
      mood={mood}
      style={style}
      testID={testID}
      title={title}
    />
  );
}
