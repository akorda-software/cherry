import { memo, useMemo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import type { IconName } from "../art";
import { haptics } from "../motion/haptics";
import { useOnChange, usePop } from "../motion/pop";
import { useTheme } from "../providers/theme-provider";
import type { AppTheme } from "../themes/theme-types";
import type { PastelName } from "../tokens/primitives/color";
import { type ElevationLevel, elevationOffsets } from "../tokens/primitives/elevation";
import { IconSlot } from "./icon-slot";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

export type TagStickerState = "neutral" | "selected" | "blocked" | "shared" | "muted";
export type TagStickerSize = "sm" | "md" | "lg";

export interface TagStickerProps {
  label: string;
  /** Emoji de la etiqueta (contenido, nunca icono de interfaz). */
  emoji?: string | null;
  /**
   * neutral = blanca · selected = menta + corazón · blocked = tomate suave con
   * rayas + ✕ + tachado · shared = limonada + destello · muted = recortable a trazos.
   */
  state?: TagStickerState;
  size?: TagStickerSize;
  /** Tinte pastel suave para el estado neutral (p. ej. color de su categoría). */
  tint?: PastelName;
  /** Borde blanco troquelado (pegatinas sobre fotos). */
  diecut?: boolean;
  /** Giro en grados. */
  rotate?: number;
  disabled?: boolean;
  onPress?(): void;
  onLongPress?(): void;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface Spec {
  height: number;
  paddingX: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  emoji: number;
  icon: number;
  gap: number;
  border: number;
  elevation: ElevationLevel;
}

function sizeSpec(theme: AppTheme, size: TagStickerSize): Spec {
  const { border, fonts } = theme.primitives;

  switch (size) {
    case "sm":
      return { height: 30, paddingX: 10, fontFamily: fonts.extraBold, fontSize: 13, lineHeight: 17, emoji: 13, icon: 14, gap: 5, border: border.thin, elevation: "sm" };
    case "lg":
      return { height: 46, paddingX: 16, fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 22, emoji: 19, icon: 18, gap: 7, border: border.regular, elevation: "md" };
    default:
      return { height: 38, paddingX: 13, fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 20, emoji: 16, icon: 16, gap: 6, border: border.regular, elevation: "sm" };
  }
}

const stateSpeech: Record<TagStickerState, string> = {
  neutral: "",
  selected: "elegida",
  blocked: "bloqueada",
  shared: "en común",
  muted: "no disponible"
};

/**
 * Pegatina de etiqueta: el componente estrella de Snack. El estado nunca
 * depende solo del color (icono, rayas, tachado o trazo discontinuo). Al
 * cambiar de estado se despega y se vuelve a pegar (pop) con háptico.
 */
export const TagSticker = memo(function TagSticker({
  label,
  emoji,
  state = "neutral",
  size = "md",
  tint,
  diecut = false,
  rotate = 0,
  disabled = false,
  onPress,
  onLongPress,
  accessibilityHint,
  testID,
  style
}: TagStickerProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const spec = sizeSpec(theme, size);
  const interactive = Boolean(onPress || onLongPress);
  const { pop, style: popStyle } = usePop({ rotate });

  useOnChange(state, (next, previous) => {
    const sticking = next === "selected" || next === "blocked" || next === "shared";
    pop(next === "blocked" ? -1 : 1);

    if (interactive && (sticking || previous === "selected" || previous === "blocked")) {
      haptics.selection();
    }
  });

  const look = useMemo(() => {
    switch (state) {
      case "selected":
        return { fill: theme.semantic.tag.likedBackground, text: c.ink, border: c.ink, icon: "heart" as IconName, iconFill: c.fresa, iconColor: c.ink };
      case "blocked":
        return { fill: theme.semantic.tag.blockedBackground, text: theme.semantic.tag.blockedForeground, border: c.ink, icon: "x" as IconName, iconFill: undefined, iconColor: theme.semantic.tag.blockedForeground };
      case "shared":
        return { fill: theme.semantic.tag.sharedBackground, text: c.ink, border: c.ink, icon: "sparkle" as IconName, iconFill: c.white, iconColor: c.ink };
      case "muted":
        return { fill: c.paperDeep, text: c.inkSoft, border: c.inkFaint, icon: undefined, iconFill: undefined, iconColor: c.inkSoft };
      default:
        return {
          fill: tint ? theme.primitives.pastel[tint].soft : theme.semantic.tag.neutralBackground,
          text: c.ink,
          border: c.ink,
          icon: interactive ? ("plus" as IconName) : undefined,
          iconFill: undefined,
          iconColor: c.inkSoft
        };
    }
  }, [c, interactive, state, theme, tint]);

  const flat = state === "muted" || disabled;
  const radius = spec.height / 2;
  const accessibilityLabel = [emoji, label].filter(Boolean).join(" ") + (stateSpeech[state] ? `, ${stateSpeech[state]}` : "");

  const face: ViewStyle = {
    minHeight: spec.height,
    paddingHorizontal: spec.paddingX,
    borderRadius: radius,
    borderWidth: spec.border,
    borderColor: look.border,
    borderStyle: state === "muted" ? "dashed" : "solid",
    backgroundColor: look.fill,
    flexDirection: "row",
    alignItems: "center",
    gap: spec.gap,
    overflow: "hidden"
  };

  const body = (
    <>
      {state === "blocked" ? <Stripes color={c.tomate} /> : null}
      {emoji ? (
        <Text maxFontSizeMultiplier={1.3} style={{ fontSize: spec.emoji, lineHeight: spec.lineHeight }}>
          {emoji}
        </Text>
      ) : null}
      <Text
        color={look.text}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={[
          { fontFamily: spec.fontFamily, fontSize: spec.fontSize, lineHeight: spec.lineHeight, flexShrink: 1 },
          state === "blocked" ? styles.struck : null
        ]}
      >
        {label}
      </Text>
      {look.icon ? <IconSlot color={look.iconColor} fill={look.iconFill} icon={look.icon} size={spec.icon} /> : null}
    </>
  );

  const hitSlop = Math.max(0, Math.ceil((48 - spec.height) / 2));
  const outerRadius = diecut ? radius + DIECUT : radius;
  const ring: ViewStyle = { padding: DIECUT, borderRadius: outerRadius, backgroundColor: c.white };
  const shadowOffset = flat ? 0 : elevationOffsets[spec.elevation];

  const sticker = interactive ? (
    <PressableScale
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      aria-checked={state === "selected" || state === "blocked"}
      disabled={disabled}
      elevation={flat ? "none" : spec.elevation}
      faceStyle={diecut ? ring : face}
      hitSlop={{ top: hitSlop, bottom: hitSlop, left: 2, right: 2 }}
      onLongPress={onLongPress}
      onPress={onPress}
      pressedScale={0.96}
      radius={outerRadius}
      releaseSpring="pop"
      testID={testID}
    >
      {diecut ? <View style={face}>{body}</View> : body}
    </PressableScale>
  ) : (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="text" accessible testID={testID}>
      {shadowOffset > 0 ? (
        <View
          style={[
            styles.shadow,
            {
              borderRadius: outerRadius,
              backgroundColor: c.ink,
              transform: [{ translateX: shadowOffset }, { translateY: shadowOffset }]
            }
          ]}
        />
      ) : null}
      {diecut ? (
        <View style={ring}>
          <View style={face}>{body}</View>
        </View>
      ) : (
        <View style={face}>{body}</View>
      )}
    </View>
  );

  return (
    <Animated.View style={[styles.wrap, disabled ? { opacity: theme.primitives.opacity.disabled } : null, popStyle, style]}>
      {sticker}
    </Animated.View>
  );
});

/** Margen blanco del troquel. */
const DIECUT = 4;

/** Rayas diagonales de «bloqueada» (recortadas por la pastilla). */
function Stripes({ color }: { color: string }) {
  const d = useMemo(() => {
    let path = "";
    for (let x = -60; x < 360; x += 8) {
      path += `M${x} 60L${x + 60} 0`;
    }
    return path;
  }, []);

  return (
    <View style={styles.stripes}>
      <Svg height={60} width={360}>
        <Path d={d} opacity={0.5} stroke={color} strokeWidth={2.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start"
  },
  shadow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  stripes: {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none"
  },
  struck: {
    textDecorationLine: "line-through"
  }
});
