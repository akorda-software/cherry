import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { type PastelName, StickyNote, Text } from "../../../shared/ui";

export interface BioNoteProps {
  bio: string | null | undefined;
  /** Papel de la nota (def. limonada). */
  color?: PastelName;
  tilt?: number;
  /** Líneas como mucho (feed); sin límite en el perfil completo. */
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** La bio escrita a mano en una nota adhesiva con su tira de washi. */
export const BioNote = memo(function BioNote({ bio, color = "limonada", tilt = -1.5, numberOfLines, style, testID }: BioNoteProps) {
  const text = bio?.trim();

  if (!text) {
    return null;
  }

  return (
    <StickyNote color={color} padding={14} style={style} testID={testID} tilt={tilt}>
      <Text accessibilityLabel={`Bio: ${text}`} maxFontSizeMultiplier={1.4} numberOfLines={numberOfLines} variant="hand">
        {text}
      </Text>
    </StickyNote>
  );
});
