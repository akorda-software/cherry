import { memo, type PropsWithChildren, useEffect } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import type { ElevationLevel } from "../tokens/primitives/elevation";

export interface StickerProps {
  /** Relleno pastel del interior (def. blanco: pegatina blanca). */
  color?: PastelName;
  shape?: "rounded" | "pill" | "circle";
  /** Giro en grados. */
  rotation?: number;
  /** Grosor del borde blanco troquelado (def. 5). */
  rim?: number;
  /** Relleno interior alrededor del contenido (def. 8 vertical / 12 horizontal). */
  padding?: number | { x: number; y: number };
  elevation?: Exclude<ElevationLevel, "none">;
  /** Se «pega» al montarse: escala 1.12 → 1 con un giro que se asienta. */
  pop?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Convierte cualquier contenido en pegatina: borde blanco troquelado, contorno
 * de tinta y sombra dura, con giro opcional.
 */
export const Sticker = memo(function Sticker({
  children,
  color,
  shape = "rounded",
  rotation = 0,
  rim = 5,
  padding,
  elevation = "sm",
  pop = false,
  style,
  contentStyle,
  testID
}: PropsWithChildren<StickerProps>) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const outline = theme.primitives.border.regular;
  const outerRadius = shape === "rounded" ? theme.primitives.radius.md : 999;
  const innerRadius = shape === "rounded" ? Math.max(outerRadius - rim - outline, 4) : 999;
  const pad = typeof padding === "number" ? { x: padding, y: padding } : padding ?? { x: 12, y: 8 };

  const settle = useSharedValue(pop ? 0 : 1);
  const appear = useSharedValue(pop ? 0 : 1);

  useEffect(() => {
    if (!pop) {
      return;
    }
    appear.value = withTiming(1, { duration: theme.primitives.motion.quick });
    settle.value = reducedMotion ? 1 : withSpring(1, theme.primitives.motion.spring.pop);
  }, [appear, pop, reducedMotion, settle, theme.primitives.motion.quick, theme.primitives.motion.spring.pop]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ rotate: `${rotation + 6 * (1 - settle.value)}deg` }, { scale: 1.12 - 0.12 * settle.value }]
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          alignSelf: "flex-start",
          backgroundColor: theme.primitives.color.white,
          borderColor: theme.primitives.color.ink,
          borderWidth: outline,
          borderRadius: outerRadius,
          padding: rim
        },
        theme.primitives.elevation[elevation],
        animatedStyle,
        style
      ]}
    >
      <View
        style={[
          {
            backgroundColor: color ? theme.primitives.pastel[color].fill : theme.primitives.color.white,
            borderRadius: innerRadius,
            paddingHorizontal: pad.x,
            paddingVertical: pad.y,
            alignItems: "center",
            justifyContent: "center"
          },
          shape === "circle" && { aspectRatio: 1 },
          contentStyle
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
});
