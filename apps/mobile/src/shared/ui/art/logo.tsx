import { memo } from "react";
import { Text as RNText, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { Mascot } from "./mascot";

export interface LogoProps {
  /** Alto total en puntos (def. 40): el lienzo de Mochi. */
  height?: number;
  /** Con la palabra «cherry» al lado (def. sí). Sin ella, solo Mochi. */
  wordmark?: boolean;
  /** Def. «Cherry». */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Proporción de la palabra respecto al alto de Mochi. */
const WORDMARK_SCALE = 0.56;

/**
 * Logotipo: Mochi enamorada (la mascota con ojos de corazón, quieta) y, al lado, «cherry» en Rubik
 * Black con el interletraje cerrado. Es una sola imagen para el lector de pantalla.
 */
export const Logo = memo(function Logo({
  height = 40,
  wordmark = true,
  accessibilityLabel = "Cherry",
  style,
  testID
}: LogoProps) {
  const theme = useTheme();
  const fontSize = Math.round(height * WORDMARK_SCALE);

  return (
    <View
      accessible
      aria-label={accessibilityLabel}
      role="img"
      style={[styles.row, { height, gap: Math.round(height * 0.04) }, style]}
      testID={testID}
    >
      <Mascot animated={false} mood="love" size={height} />
      {wordmark ? (
        <RNText
          allowFontScaling={false}
          aria-hidden
          importantForAccessibility="no"
          style={{
            color: theme.primitives.color.ink,
            fontFamily: theme.primitives.fonts.display,
            fontSize,
            lineHeight: Math.round(fontSize * 1.2),
            letterSpacing: -fontSize * 0.04,
            // Las cerezas pesan abajo: la palabra baja un poco para alinearse con ellas.
            marginTop: Math.round(height * 0.16)
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
