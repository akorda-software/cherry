import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import type { DiscoveryProfileCard } from "@snack/contracts";

import { useTheme } from "../../../shared/ui";

interface ProfileFeedCardProps {
  card: DiscoveryProfileCard;
  onPress(card: DiscoveryProfileCard): void;
}

export function ProfileFeedCard({ card, onPress }: ProfileFeedCardProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        touchable: {
          flex: 1
        },
        frame: {
          aspectRatio: 3 / 4,
          borderRadius: theme.primitives.radius.md,
          backgroundColor: theme.semantic.surface.elevated,
          overflow: "hidden",
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          ...theme.primitives.elevation.sm
        },
        image: {
          width: "100%",
          height: "100%"
        },
        placeholder: {
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.semantic.action.primaryBackground
        },
        placeholderText: {
          color: theme.semantic.text.inverse,
          fontSize: theme.primitives.typography.title.fontSize,
          fontWeight: theme.primitives.typography.title.fontWeight as any
        },
        photoCount: {
          position: "absolute",
          top: theme.primitives.spacing.sm,
          right: theme.primitives.spacing.sm,
          paddingHorizontal: theme.primitives.spacing.sm,
          paddingVertical: theme.primitives.spacing.xxs,
          borderRadius: theme.primitives.radius.pill,
          backgroundColor: "rgba(0,0,0,0.55)"
        },
        photoCountText: {
          color: theme.semantic.text.inverse,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: theme.primitives.typography.caption.fontWeight as any
        },
        caption: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: theme.primitives.spacing.sm,
          paddingVertical: theme.primitives.spacing.sm,
          backgroundColor: "rgba(0,0,0,0.5)"
        },
        name: {
          color: theme.semantic.text.inverse,
          fontSize: theme.primitives.typography.bodyStrong.fontSize,
          fontWeight: theme.primitives.typography.bodyStrong.fontWeight as any
        },
        meta: {
          color: theme.semantic.text.inverse,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: theme.primitives.typography.caption.fontWeight as any,
          marginTop: theme.primitives.spacing.xxs
        }
      }),
    [theme]
  );

  const handlePress = useCallback(() => onPress(card), [card, onPress]);

  return (
    <Pressable testID={`discovery-card-${card.id}`} style={styles.touchable} onPress={handlePress}>
      <View style={styles.frame}>
        {card.photoUrl ? (
          <Image source={{ uri: card.photoUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>{initials(card.displayName)}</Text>
          </View>
        )}
        {card.photoCount > 1 ? (
          <View style={styles.photoCount}>
            <Text style={styles.photoCountText}>{card.photoCount}</Text>
          </View>
        ) : null}
        <View style={styles.caption}>
          <Text style={styles.name} numberOfLines={1}>
            {card.displayName}, {card.age}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {card.distanceLabel}
            {card.sharedTagsCount > 0 ? `  ·  ${card.sharedTagsCount} en común` : null}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

