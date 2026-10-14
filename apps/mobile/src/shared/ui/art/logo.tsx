import { memo } from "react";
import { Text as RNText, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { CherryMark, type CherryMarkTone } from "./cherry-mark";

export interface LogoProps {
  /** Alto total en puntos (def. 40): el del dibujo de las cerezas. */
  height?: number;
  /** Con la palabra «cherry» al lado (def. sí). Sin ella, solo las cerezas. */
  wordmark?: boolean;
  /** `ink` / `white`: todo de una tinta (sobre foto). Def. a color. */
  tone?: CherryMarkTone;
  /** Def. «Cherry». */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Proporción de la palabra respecto al alto del dibujo. */
const WORDMARK_SCALE = 0.56;

/**
 * Logotipo: las cerezas con hojas-corazón y, al lado, «cherry» en Rubik Black con el interletraje
 * cerrado. La palabra va en tinta (o en blanco con `tone="white"`); las cerezas son el color.
 */
export const Logo = memo(function Logo({
  height = 40,
  wordmark = true,
  tone = "color",
  accessibilityLabel = "Cherry",
  style,
  testID
}: LogoProps) {
  const theme = useTheme();
  const fontSize = Math.round(height * WORDMARK_SCALE);
  const wordColor = tone === "white" ? theme.primitives.color.white : theme.primitives.color.ink;

  return (
    <View
      accessible
      aria-label={accessibilityLabel}
      role="img"
      style={[styles.row, { height, gap: Math.round(height * 0.16) }, style]}
      testID={testID}
    >
      <CherryMark decorative size={height} tone={tone} />
      {wordmark ? (
        <RNText
          allowFontScaling={false}
          aria-hidden
          importantForAccessibility="no"
          style={{
            color: wordColor,
            fontFamily: theme.primitives.fonts.display,
            fontSize,
            lineHeight: Math.round(fontSize * 1.2),
            letterSpacing: -fontSize * 0.04,
            // Las cerezas pesan abajo: la palabra baja un poco para alinearse con ellas.
            marginTop: Math.round(height * 0.14)
          }}
        >
          cherry
        </RNText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start"
  }
});
