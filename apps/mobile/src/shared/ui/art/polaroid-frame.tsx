import { Image } from "expo-image";
import { memo, type PropsWithChildren } from "react";
import { type StyleProp, Text, View, type ViewStyle } from "react-native";

import { HardShadow } from "../primitives/hard-shadow";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { Icon } from "./icon";
import { WashiTape, type WashiPattern } from "./washi-tape";

export interface PolaroidFrameProps {
  /** Foto (se pinta con expo-image). Si hay `children`, mandan los children. */
  uri?: string | null;
  /** Ancho total del marco; si no se da, ocupa el ancho del padre. */
  width?: number;
  /** Proporción ancho/alto de la foto (def. 1). `"fill"`: la foto ocupa el alto disponible. */
  photoAspectRatio?: number | "fill";
  /** Pie de foto en la franja de abajo. */
  caption?: string;
  /** Tiras de washi: en las dos esquinas de arriba, una centrada arriba o ninguna. */
  tapes?: "corners" | "top" | "none";
  tapeColors?: [PastelName, PastelName?];
  tapePattern?: WashiPattern;
  /** Inclinación en grados. */
  tilt?: number;
  elevation?: "md" | "lg" | "xl";
  /** Descripción de la foto para lectores de pantalla. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIDE = 10;

/**
 * Marco polaroid: borde blanco (más ancho abajo), contorno de tinta, sombra
 * dura y tiras de washi opcionales en las esquinas. La foto nunca queda tapada:
 * las cintas solo pisan el marco.
 */
export const PolaroidFrame = memo(function PolaroidFrame({
  children,
  uri,
  width,
  photoAspectRatio = 1,
  caption,
  tapes = "corners",
  tapeColors = ["lavanda", "menta"],
  tapePattern = "dots",
  tilt = 0,
  elevation = "lg",
  accessibilityLabel,
  style,
  testID
}: PropsWithChildren<PolaroidFrameProps>) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const fill = photoAspectRatio === "fill";
  const bottom = caption ? 46 : 30;
  const tapeWidth = Math.min(Math.max((width ?? 260) * 0.3, 58), 96);

  return (
    <HardShadow
      testID={testID}
      elevation={elevation}
      style={[
        {
          width,
          backgroundColor: c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.regular,
          borderRadius: theme.primitives.radius.xs,
          paddingTop: SIDE,
          paddingHorizontal: SIDE,
          paddingBottom: bottom,
          transform: [{ rotate: `${tilt}deg` }]
        },
        fill && { flex: 1 },
        style
      ]}
    >
      <View
        style={[
          {
            overflow: "hidden",
            borderRadius: 3,
            backgroundColor: c.paperDeep,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.hairline
          },
          fill ? { flex: 1 } : { aspectRatio: photoAspectRatio }
        ]}
      >
        {children ??
          (uri ? (
            <Image
              source={{ uri }}
              contentFit="cover"
              transition={180}
              style={{ width: "100%", height: "100%" }}
              accessibilityLabel={accessibilityLabel}
              accessible={Boolean(accessibilityLabel)}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Icon name="image" size={32} color={c.inkFaint} />
            </View>
          ))}
      </View>

      {caption ? (
        <View style={{ position: "absolute", left: SIDE, right: SIDE, bottom: 8, alignItems: "center" }}>
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={[theme.primitives.text.hand, { color: c.ink, fontSize: 19, lineHeight: 26 }]}
          >
            {caption}
          </Text>
        </View>
      ) : null}

      {tapes === "corners" ? (
        <>
          <WashiTape
            width={tapeWidth}
            height={24}
            color={tapeColors[0]}
            pattern={tapePattern}
            rotation={-38}
            style={{ position: "absolute", top: 2, left: -tapeWidth * 0.3 }}
          />
          <WashiTape
            width={tapeWidth}
            height={24}
            color={tapeColors[1] ?? tapeColors[0]}
            pattern={tapePattern === "dots" ? "stripes" : tapePattern}
            rotation={38}
            style={{ position: "absolute", top: 2, right: -tapeWidth * 0.3 }}
          />
        </>
      ) : null}
      {tapes === "top" ? (
        <View style={{ position: "absolute", top: -12, left: 0, right: 0, alignItems: "center", pointerEvents: "none" }}>
          <WashiTape width={tapeWidth * 1.2} height={24} color={tapeColors[0]} pattern={tapePattern} rotation={-3} />
        </View>
      ) : null}
    </HardShadow>
  );
});
