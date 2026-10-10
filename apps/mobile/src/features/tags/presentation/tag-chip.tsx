import { memo, useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import type { Tag } from "@cherry/contracts";

import { HardShadowLayer, Icon, Text, useTheme } from "../../../shared/ui";
import type { TagKind, TagSelectionState } from "../domain/tag-selection";

export interface TagChipProps {
  tag: Tag;
  state: TagSelectionState;
  /** Referencia estable: la ficha está memorizada y solo se repinta si cambia su estado. */
  onPress(tag: Tag, kind: TagKind): void;
  testID: string;
}

/** Alto mínimo de la ficha (emoji + nombre en dos líneas + barra de teclas). */
export const CHIP_HEIGHT = 112;
const BAR_HEIGHT = 34;
const RADIUS = 14;
/** Separación entre fichas: el área táctil nunca invade la del vecino. */
export const CHIP_COLUMN_GAP = 10;
export const CHIP_ROW_GAP = 12;
const SLOP = CHIP_ROW_GAP / 2;

/**
 * Pegatina de una etiqueta en la hoja de tres columnas: el emoji grande, el nombre
 * debajo y, a lo ancho del pie, una barra partida «− | +». Me gusta = menta, sombra y
 * la mitad «+» en tinta con ✓; bloqueada = tomate suave, emoji apagado, nombre tachado
 * y la mitad «−» en tomate con ✕: el estado nunca depende solo del color. Al cambiar
 * de estado hace un «pop» corto (nunca en bucle).
 */
export const TagChip = memo(function TagChip({ tag, state, onPress, testID }: TagChipProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const reduced = useReducedMotion();
  const liked = state === "liked";
  const blocked = state === "blocked";
  const onLike = useCallback(() => onPress(tag, "positive"), [onPress, tag]);
  const onBlock = useCallback(() => onPress(tag, "blocked"), [onPress, tag]);

  const pop = useSharedValue(1);
  const previous = useRef(state);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (reduced) return;
    pop.value = withSequence(withTiming(state === "neutral" ? 0.94 : 1.07, { duration: 90 }), withSpring(1, { damping: 11, stiffness: 320 }));
  }, [pop, reduced, state]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const face = liked
    ? theme.semantic.tag.likedBackground
    : blocked
      ? theme.semantic.tag.blockedBackground
      : theme.semantic.tag.neutralBackground;

  return (
    <Animated.View style={[styles.outer, popStyle]} testID={testID}>
      <HardShadowLayer elevation={liked || blocked ? "sm" : "xs"} radius={RADIUS} />
      <View
        style={[
          styles.face,
          { backgroundColor: face, borderColor: c.ink, borderWidth: theme.primitives.border.thin }
        ]}
      >
        <View style={styles.body}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            maxFontSizeMultiplier={1.1}
            style={[styles.emoji, blocked ? styles.dimmed : null]}
          >
            {tag.emoji ?? "•"}
          </Text>
          <Text
            align="center"
            color={blocked ? theme.semantic.tag.blockedForeground : "default"}
            maxFontSizeMultiplier={1.2}
            numberOfLines={2}
            style={[styles.label, { fontFamily: theme.primitives.fonts.bold }, blocked ? styles.struck : null]}
            variant="caption"
          >
            {tag.label}
          </Text>
        </View>
        <View style={[styles.bar, { borderTopColor: c.ink, borderTopWidth: theme.primitives.border.thin }]}>
          <TagSegment
            active={blocked}
            kind="blocked"
            label={`Bloquear: ${tag.label}`}
            onPress={onBlock}
            testID={`${testID}-block`}
          />
          <View style={[styles.divider, { backgroundColor: c.ink, width: theme.primitives.border.thin }]} />
          <TagSegment
            active={liked}
            kind="positive"
            label={`Me gusta: ${tag.label}`}
            onPress={onLike}
            testID={`${testID}-like`}
          />
        </View>
      </View>
    </Animated.View>
  );
});

interface TagSegmentProps {
  kind: TagKind;
  active: boolean;
  label: string;
  onPress(): void;
  testID: string;
}

/**
 * Mitad de la barra. «−» activa = relleno tomate con ✕ en tinta; «+» activa = relleno
 * de tinta con ✓ menta (marca, no solo color).
 */
const TagSegment = memo(function TagSegment({ kind, active, label, onPress, testID }: TagSegmentProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const positive = kind === "positive";
  const activeFill = positive ? c.ink : theme.primitives.pastel.tomate.fill;
  const bar = { backgroundColor: c.ink, borderRadius: STROKE / 2 };

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      aria-checked={active}
      hitSlop={{ top: 4, bottom: SLOP, left: positive ? 0 : SLOP / 2, right: positive ? SLOP / 2 : 0 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        positive ? styles.segmentEnd : styles.segmentStart,
        { backgroundColor: active ? activeFill : pressed ? c.paperDeep : "transparent" }
      ]}
      testID={testID}
    >
      {active ? (
        <Icon
          color={positive ? theme.primitives.pastel.menta.fill : c.ink}
          name={positive ? "check" : "x"}
          size={17}
          strokeWidth={3}
          testID={`${testID}-mark`}
        />
      ) : (
        <>
          <View style={[styles.barHorizontal, bar]} />
          {positive ? <View style={[styles.barVertical, bar]} /> : null}
        </>
      )}
    </Pressable>
  );
});

const GLYPH = 12;
const STROKE = 2.5;
const INNER_RADIUS = RADIUS - 2;

const styles = StyleSheet.create({
  outer: {
    flexGrow: 1,
    minHeight: CHIP_HEIGHT
  },
  face: {
    flexGrow: 1,
    borderRadius: RADIUS,
    overflow: "hidden"
  },
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 8
  },
  emoji: {
    fontSize: 28,
    lineHeight: 34
  },
  dimmed: {
    opacity: 0.4
  },
  label: {
    fontSize: 12.5,
    lineHeight: 15
  },
  struck: {
    textDecorationLine: "line-through"
  },
  bar: {
    flexDirection: "row",
    height: BAR_HEIGHT
  },
  divider: {
    alignSelf: "stretch"
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentStart: {
    borderBottomLeftRadius: INNER_RADIUS
  },
  segmentEnd: {
    borderBottomRightRadius: INNER_RADIUS
  },
  barHorizontal: {
    width: GLYPH,
    height: STROKE
  },
  barVertical: {
    position: "absolute",
    width: STROKE,
    height: GLYPH
  }
});
