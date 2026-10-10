import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type {
  DiscoveryActionRequest,
  DiscoveryActionType,
  DiscoveryProfileCard
} from "@cherry/contracts";
import { createDiscoveryApi, type DiscoveryApi } from "@cherry/mobile-shared";

import { useSessionShell } from "../../auth/presentation";
import { useRuntimeConfig } from "../../../shared/config";
import { createJsonHttpClient } from "../../../shared/api";
import { Button, EmptyState, useTheme } from "../../../shared/ui";
import { useDiscoveryFeed } from "../application/use-discovery-feed";
import { ProfileDetailSheet } from "./profile-detail-sheet";
import { ProfileFeedGrid } from "./profile-feed-grid";

const PAGE_SIZE = 20;

export function DiscoveryFeedScreen() {
  const theme = useTheme();
  const { executeAuthenticated } = useSessionShell();
  const { apiBaseUrl } = useRuntimeConfig();

  const callApi = useCallback(
    <T,>(run: (api: DiscoveryApi) => Promise<T>) =>
      executeAuthenticated((token) => {
        const client = createJsonHttpClient({
          apiBaseUrl,
          getHeaders: () => ({ Authorization: `Bearer ${token}` })
        });
        return run(createDiscoveryApi(client));
      }),
    [apiBaseUrl, executeAuthenticated]
  );

  const fetchPage = useCallback(
    (cursor: string | null) => callApi((api) => api.getFeed({ cursor, limit: PAGE_SIZE })),
    [callApi]
  );
  const recordAction = useCallback(
    (request: DiscoveryActionRequest) => callApi((api) => api.recordAction(request)),
    [callApi]
  );

  const feed = useDiscoveryFeed({ fetchPage, recordAction });
  const [selectedCard, setSelectedCard] = useState<DiscoveryProfileCard | null>(null);

  const handleAction = useCallback(
    async (card: DiscoveryProfileCard, actionType: DiscoveryActionType) => {
      const result = await feed.act({ targetProfileId: card.id, actionType });

      if (result !== null) {
        setSelectedCard(null);
      }
    },
    [feed]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: theme.semantic.color.screenBackground
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: theme.primitives.spacing.md,
          padding: theme.primitives.spacing.xl
        },
        errorText: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: theme.primitives.typography.body.fontWeight as any,
          textAlign: "center"
        },
        empty: {
          padding: theme.primitives.spacing.xl
        },
        matchRoot: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
          padding: theme.primitives.spacing.xl
        },
        matchCard: {
          backgroundColor: theme.semantic.color.surfaceBackground,
          borderRadius: theme.primitives.radius.md,
          borderWidth: theme.primitives.border.heavy,
          borderColor: theme.primitives.color.ink,
          padding: theme.primitives.spacing.xl,
          alignItems: "center",
          gap: theme.primitives.spacing.md,
          ...theme.primitives.elevation.lg
        },
        matchTitle: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.title.fontSize,
          fontWeight: theme.primitives.typography.title.fontWeight as any
        },
        matchText: {
          color: theme.semantic.text.muted,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: theme.primitives.typography.body.fontWeight as any
        }
      }),
    [theme]
  );

  if (feed.status === "loading") {
    return (
      <View style={styles.center} testID="discovery-loading">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (feed.status === "error") {
    return (
      <View style={styles.center} testID="discovery-error">
        <Text style={styles.errorText}>{feed.error ?? "No se pudo cargar el feed"}</Text>
        <Button onPress={() => void feed.reload()}>Reintentar</Button>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="discovery-feed">
      <ProfileFeedGrid
        profiles={feed.profiles}
        hasMore={feed.hasMore}
        loadingMore={feed.loadingMore}
        onOpenCard={setSelectedCard}
        onLoadMore={() => void feed.loadMore()}
        ListEmptyComponent={
          <View style={styles.empty} testID="discovery-empty">
            <EmptyState
              title="No hay personas cerca de ti"
              description="Prueba ampliando tu distancia en los ajustes de descubrimiento."
              action={<Button onPress={() => void feed.reload()}>Reintentar</Button>}
            />
          </View>
        }
      />
      <ProfileDetailSheet
        card={selectedCard}
        acting={selectedCard !== null && feed.actingOnProfileId === selectedCard.id}
        error={selectedCard === null ? null : feed.actionError}
        onClose={() => setSelectedCard(null)}
        onAction={handleAction}
      />
      <Modal
        visible={feed.lastMatch !== null}
        transparent
        animationType="fade"
        onRequestClose={feed.dismissMatch}
      >
        <Pressable style={styles.matchRoot} testID="discovery-match" onPress={feed.dismissMatch}>
          <View style={styles.matchCard}>
            <Text style={styles.matchTitle}>¡Hiciste match!</Text>
            <Text style={styles.matchText}>
              {feed.lastMatch?.otherProfile.displayName ?? "Alguien"} también te dio like.
            </Text>
            <Button onPress={feed.dismissMatch}>Seguir descubriendo</Button>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
