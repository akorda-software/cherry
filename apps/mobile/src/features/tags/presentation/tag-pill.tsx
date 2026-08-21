import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { Tag } from "@snack/contracts";

import { useTheme } from "../../../shared/ui";
import type { TagSelectionState } from "../application/use-tag-selection";

export type TagPillState = TagSelectionState;

interface TagPillProps {
  tag: Tag;
  state: TagPillState;
  likeDisabled?: boolean;
  blockDisabled?: boolean;
  onToggleLike(): void;
  onToggleBlock(): void;
}

export function TagPill({
  tag,
  state,
  likeDisabled = false,
  blockDisabled = false,
  onToggleLike,
  onToggleBlock
}: TagPillProps) {
  const theme = useTheme();

  const backgroundColor =
    state === "liked"
      ? theme.primitives.color.green
      : state === "blocked"
        ? theme.primitives.color.red
        : theme.semantic.color.surfaceBackground;

  const isNeutral = state === "neutral";
  const iconColor = isNeutral ? theme.primitives.color.ink : theme.semantic.text.inverse;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.primitives.spacing.xs,
          paddingVertical: theme.primitives.spacing.xs,
          paddingHorizontal: theme.primitives.spacing.xs,
          borderRadius: theme.primitives.radius.pill,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          backgroundColor
        },
        label: {
          color: isNeutral ? theme.semantic.text.default : theme.semantic.text.inverse,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "700" as any
        },
        iconButton: {
          width: 24,
          height: 24,
          alignItems: "center",
          justifyContent: "center"
        },
        disabled: {
          opacity: theme.primitives.opacity.disabled
        }
      }),
    [backgroundColor, isNeutral, theme]
  );

  return (
    <View style={styles.pill} testID={`tag-pill-${tag.slug}`}>
      <Pressable
        testID={`tag-pill-${tag.slug}-block`}
        style={blockDisabled ? [styles.iconButton, styles.disabled] : styles.iconButton}
        disabled={blockDisabled}
        onPress={onToggleBlock}
        hitSlop={4}
      >
        <CrossIcon color={iconColor} active={state === "blocked"} />
      </Pressable>
      <Text style={styles.label}>{tag.label}</Text>
      <Pressable
        testID={`tag-pill-${tag.slug}-like`}
        style={likeDisabled ? [styles.iconButton, styles.disabled] : styles.iconButton}
        disabled={likeDisabled}
        onPress={onToggleLike}
        hitSlop={4}
      >
        <HeartIcon color={iconColor} filled={state === "liked"} />
      </Pressable>
    </View>
  );
}

interface IconProps {
  color: string;
  size?: number;
}

function HeartIcon({ color, filled, size = 16 }: IconProps & { filled: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CrossIcon({ color, active, size = 16 }: IconProps & { active: boolean }) {
  const width = active ? 3.5 : 2.5;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6 L18 18" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <Path d="M18 6 L6 18" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </Svg>
  );
}
