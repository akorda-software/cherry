import { PrivatePhotoImage as Image } from "../../media/private-photo-image";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import type { ElevationLevel } from "../tokens/primitives/elevation";
import { HardShadow } from "./hard-shadow";
import { Text } from "./text";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  uri?: string | null;
  /** Nombre: da la inicial, el color por defecto y la etiqueta accesible. */
  name?: string | null;
  /** xs 32 · sm 40 · md 56 · lg 80 · xl 112, o px. */
  size?: AvatarSize | number;
  /** Relleno de la inicial cuando no hay foto (por defecto, según el nombre). */
  color?: PastelName;
  /** Aro pastel de «nuevo» (true = fresa). */
  ring?: PastelName | boolean;
  elevation?: ElevationLevel;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const sizes: Record<AvatarSize, number> = { xs: 32, sm: 40, md: 56, lg: 80, xl: 112 };
const palette: PastelName[] = ["fresa", "menta", "lavanda", "limonada", "cielo", "melocoton"];

/** Color estable a partir del nombre (la misma persona siempre igual). */
export function pastelForName(name: string | null | undefined): PastelName {
  const key = (name ?? "").trim();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length] ?? "fresa";
}

/** Foto redonda con contorno de tinta; sin foto, inicial Mochiy sobre pastel. */
export function Avatar({
  uri,
  name,
  size = "md",
  color,
  ring,
  elevation = "none",
  accessibilityLabel,
  testID,
  style
}: AvatarProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const px = typeof size === "number" ? size : sizes[size];
  const border = px >= 80 ? theme.primitives.border.bold : px >= 40 ? theme.primitives.border.regular : theme.primitives.border.thin;
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "·";
  const fill = theme.primitives.pastel[color ?? pastelForName(name)].fill;
  const ringColor = ring ? theme.primitives.pastel[ring === true ? "fresa" : ring].fill : null;
  const ringGap = Math.max(3, Math.round(px * 0.07));

  const faceStyle: StyleProp<ViewStyle> = [
    styles.face,
    {
      width: px,
      height: px,
      borderRadius: px / 2,
      borderWidth: border,
      borderColor: c.ink,
      backgroundColor: fill
    }
  ];
  const content = uri ? (
    <Image contentFit="cover" source={{ uri }} style={styles.image} transition={180} />
  ) : (
    <Text
      color={c.ink}
      maxFontSizeMultiplier={1}
      style={{ fontFamily: theme.primitives.fonts.display, fontSize: px * 0.42, lineHeight: px * 0.52 }}
    >
      {initial}
    </Text>
  );
  // Con aro, la sombra es del aro; sin él, de la cara (vista hermana, nunca `boxShadow`).
  const face =
    ringColor || elevation === "none" ? (
      <View style={faceStyle}>{content}</View>
    ) : (
      <HardShadow elevation={elevation} style={faceStyle}>
        {content}
      </HardShadow>
    );

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? (name ? `Foto de ${name}` : undefined)}
      accessible={Boolean(accessibilityLabel ?? name)}
      role="img"
      style={style}
      testID={testID}
    >
      {ringColor ? (
        <HardShadow
          elevation={elevation}
          style={[
            styles.ring,
            {
              padding: ringGap,
              borderRadius: (px + 2 * ringGap + 2 * theme.primitives.border.regular) / 2,
              borderWidth: theme.primitives.border.regular,
              borderColor: c.ink,
              backgroundColor: ringColor
            }
          ]}
        >
          {face}
        </HardShadow>
      ) : (
        face
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  ring: {
    alignSelf: "flex-start"
  }
});
