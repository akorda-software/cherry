import { useCallback, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import type { DiscoveryActionType, DiscoveryProfileCard } from "@snack/contracts";

import { Button, useTheme } from "../../../shared/ui";

interface ProfileDetailSheetProps {
  card: DiscoveryProfileCard | null;
  acting: boolean;
  error: string | null;
  onClose(): void;
  onAction(card: DiscoveryProfileCard, actionType: DiscoveryActionType): void;
}

export function ProfileDetailSheet({
  card,
  acting,
  error,
  onClose,
  onAction
}: ProfileDetailSheetProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: theme.semantic.color.screenBackground
        },
        topBar: {
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingHorizontal: theme.primitives.spacing.md,
          paddingTop: theme.primitives.spacing.lg
        },
        closeText: {
          color: theme.semantic.text.accent,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: theme.primitives.typography.body.fontWeight as any
        },
        scroll: {
          flexGrow: 1,
          padding: theme.primitives.spacing.lg,
          gap: theme.primitives.spacing.md
        },
        photoFrame: {
          width: "100%",
          aspectRatio: 3 / 4,
          borderRadius: theme.primitives.radius.md,
          overflow: "hidden",
          backgroundColor: theme.semantic.surface.elevated,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          ...theme.primitives.elevation.md
        },
        photo: {
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
        name: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.title.fontSize,
          fontWeight: theme.primitives.typography.title.fontWeight as any
        },
        meta: {
          color: theme.semantic.text.muted,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: theme.primitives.typography.body.fontWeight as any
        },
        section: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: theme.primitives.typography.body.fontWeight as any,
          lineHeight: theme.primitives.typography.body.fontSize * 1.4
        },
        hint: {
          color: theme.semantic.text.muted,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: theme.primitives.typography.caption.fontWeight as any
        },
        error: {
          color: theme.semantic.state.danger,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: theme.primitives.typography.caption.fontWeight as any
        },
        actions: {
          flexDirection: "row",
          gap: theme.primitives.spacing.md,
          padding: theme.primitives.spacing.lg
        },
        grow: {
          flex: 1
        }
      }),
    [theme]
  );

  const handleLike = useCallback(() => {
    if (card) {
      onAction(card, "like");
    }
  }, [card, onAction]);

  const handleDislike = useCallback(() => {
    if (card) {
      onAction(card, "dislike");
    }
  }, [card, onAction]);

  return (
    <Modal
      visible={card !== null}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.root} testID="discovery-detail">
        <View style={styles.topBar}>
          <Pressable testID="discovery-detail-close" onPress={onClose}>
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {card ? (
            <>
              <View style={styles.photoFrame}>
                {card.photoUrl ? (
                  <Image source={{ uri: card.photoUrl }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.placeholder]}>
                    <Text style={styles.placeholderText}>{card.displayName.slice(0, 1)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.name}>
                {card.displayName}, {card.age}
              </Text>
              <Text style={styles.meta}>
                {labelForLookingFor(card.whatIAmLookingFor)} · {card.distanceLabel}
              </Text>
              {card.bio ? <Text style={styles.section}>{card.bio}</Text> : null}
              {card.sharedTagsCount > 0 ? (
                <Text style={styles.hint}>{card.sharedTagsCount} etiquetas en común</Text>
              ) : null}
              {card.photoCount > 1 ? (
                <Text style={styles.hint}>+{card.photoCount - 1} fotos más</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          ) : null}
        </ScrollView>
        <View style={styles.actions}>
          <Button tone="destructive" disabled={acting} onPress={handleDislike}>
            No me interesa
          </Button>
          <View style={styles.grow} />
          <Button tone="primary" disabled={acting} onPress={handleLike}>
            Me gusta
          </Button>
        </View>
      </View>
    </Modal>
  );
}

function labelForLookingFor(value: string): string {
  switch (value) {
    case "relationship":
      return "Busca relación";
    case "casual":
      return "Busca algo casual";
    case "friendship":
      return "Busca amistad";
    default:
      return value;
  }
}
