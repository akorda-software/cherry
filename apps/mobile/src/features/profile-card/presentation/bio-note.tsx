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

/**
 * Pega los puntos suspensivos escritos a mano a la palabra siguiente (espacio duro): así el
 * recorte por líneas nunca cae justo detrás de ellos y no salen dos elipsis seguidas
 * («es... …»).
 */
export function glueEllipses(text: string): string {
  return text.replace(/(\.{3}|…)[ \t]+(?=\S)/g, "$1\u00A0");
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
        {numberOfLines ? glueEllipses(text) : text}
      </Text>
    </StickyNote>
  );
});
