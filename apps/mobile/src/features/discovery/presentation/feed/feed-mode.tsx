import { FlashList, type FlashListRef, type ViewToken } from "@shopify/flash-list";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, LayoutAnimation, Platform, StyleSheet, View } from "react-native";

import type { DiscoveryActionType, DiscoveryProfileCard } from "@snack/contracts";

import { ErrorState, haptics, Mascot, Stack, Text } from "../../../../shared/ui";
import type { DiscoveryQueueRemoval } from "../../application/discovery-queue";
import { type FeedRow, type LeavingPost, mergeLeavingPosts } from "../../domain/feed-leaving";
import { prefetchImageUrls } from "../../infrastructure/image-prefetch";
import { DiscoverEmpty, FeedPostSkeleton } from "../discover-states";
import { FeedPost } from "./feed-post";

const MAX_POST_WIDTH = 520;
/** Estable: las listas no admiten cambiar `viewabilityConfig` tras montar. */
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 40 };

interface FeedModeProps {
  profiles: DiscoveryProfileCard[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  focused: boolean;
  reducedMotion: boolean;
  lastRemoval: DiscoveryQueueRemoval | null;
  bottomSpace: number;
  onDecide(card: DiscoveryProfileCard, action: DiscoveryActionType): void;
  onOpen(card: DiscoveryProfileCard): void;
  onLoadMore(): void;
  onWidenFilters(): void;
  onRetry(): void;
}

interface LeavingEntry extends LeavingPost {
  /** Salida que no nació aquí (perfil completo, bloqueo): espera a que Descubrir esté a la vista. */
  external: boolean;
}

export function FeedMode({
  profiles,
  hasMore,
  loadingMore,
  loadMoreFailed,
  focused,
  reducedMotion,
  lastRemoval,
  bottomSpace,
  onDecide,
  onOpen,
  onLoadMore,
  onWidenFilters,
  onRetry
}: FeedModeProps) {
  const [width, setWidth] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [leaving, setLeaving] = useState<LeavingEntry[]>([]);
  const listRef = useRef<FlashListRef<FeedRow>>(null);
  const rows = useMemo(() => mergeLeavingPosts(profiles, leaving), [leaving, profiles]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.min(event.nativeEvent.layout.width - 32, MAX_POST_WIDTH);
    const height = event.nativeEvent.layout.height;
    setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
    setListHeight((current) => (Math.abs(current - height) < 1 ? current : height));
  }, []);

  /** Lo que ocupa un post aparte de la foto (nombre, insignias, datos, etiquetas, bio y botones). */
  const maxPhotoHeight = Math.max(listHeight - bottomSpace - 404, 240);

  // Salidas externas: el post se despide en su sitio (con sello si hubo decisión).
  const previous = useRef<DiscoveryProfileCard[]>(profiles);
  const decidedHere = useRef(new Set<string>());
  useLayoutEffect(() => {
    const now = new Set(profiles.map((card) => card.id));
    const vanished = previous.current
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !now.has(card.id) && !decidedHere.current.has(card.id));

    if (vanished.length > 0) {
      setLeaving((current) => [
        ...current,
        ...vanished
          .filter(({ card }) => !current.some((entry) => entry.card.id === card.id))
          .map(({ card, index }) => ({
            card,
            index,
            action: lastRemoval?.profileId === card.id ? lastRemoval.action : null,
            external: true
          }))
      ]);
    }

    for (const id of decidedHere.current) {
      if (now.has(id)) {
        decidedHere.current.delete(id);
      }
    }

    previous.current = profiles;
  }, [lastRemoval, profiles]);

  // Si una salida VUELVE a la cola (fallo de red), deja de despedirse. `departed` distingue
  // las que ya salieron de las recién decididas (que siguen en la cola un render).
  const departed = useRef(new Set<string>());
  useEffect(() => {
    const queued = new Set(profiles.map((card) => card.id));

    for (const entry of leaving) {
      if (!queued.has(entry.card.id)) {
        departed.current.add(entry.card.id);
      }
    }

    const returned = leaving.filter((entry) => departed.current.has(entry.card.id) && queued.has(entry.card.id));

    if (returned.length > 0) {
      returned.forEach((entry) => {
        departed.current.delete(entry.card.id);
        decidedHere.current.delete(entry.card.id);
      });
      setLeaving((current) => current.filter((entry) => !returned.some((back) => back.card.id === entry.card.id)));
    }
  }, [leaving, profiles]);

  // La decisión llega a la cola después de marcar el post como «despidiéndose».
  const pending = useRef<Array<{ card: DiscoveryProfileCard; action: DiscoveryActionType }>>([]);
  useEffect(() => {
    if (pending.current.length === 0) {
      return;
    }

    const decisions = pending.current;
    pending.current = [];
    decisions.forEach(({ card, action }) => onDecide(card, action));
  }, [leaving, onDecide]);

  const decide = useCallback((card: DiscoveryProfileCard, action: DiscoveryActionType) => {
    const index = rowsRef.current.findIndex((row) => row.card.id === card.id);

    if (action === "dislike") {
      haptics.light();
    }

    decidedHere.current.add(card.id);
    pending.current.push({ card, action });
    setLeaving((current) =>
      current.some((entry) => entry.card.id === card.id)
        ? [...current]
        : [...current, { card, index: Math.max(index, 0), action, external: false }]
    );
  }, []);

  const farewellDone = useCallback((profileId: string) => {
    if (Platform.OS !== "web") {
      // El hueco se cierra con suavidad (el siguiente post sube a su sitio).
      listRef.current?.prepareForLayoutAnimationRender();
      LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
    }

    decidedHere.current.delete(profileId);
    departed.current.delete(profileId);
    setLeaving((current) => current.filter((entry) => entry.card.id !== profileId));
  }, []);

  // Precarga la foto principal de los siguientes posts: el siguiente siempre llega pintado.
  const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken<FeedRow>[] }) => {
    const last = Math.max(-1, ...info.viewableItems.map((token) => token.index ?? -1));
    const upcoming = rowsRef.current.slice(last + 1, last + 4);
    prefetchImageUrls(
      upcoming.flatMap((row) => row.card.photos.slice(0, 2).map((photo) => photo.url))
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedRow }) => (
      <FeedPost
        card={item.card}
        holdFarewell={item.leaving !== null && (leaving.find((entry) => entry.card.id === item.card.id)?.external ?? false) && !focused}
        leaving={item.leaving ? item.leaving.action : undefined}
        maxPhotoHeight={maxPhotoHeight}
        onDecide={decide}
        onFarewellDone={farewellDone}
        onOpen={onOpen}
        reducedMotion={reducedMotion}
        width={width}
      />
    ),
    [decide, farewellDone, focused, leaving, maxPhotoHeight, onOpen, reducedMotion, width]
  );

  const footer = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }

    if (loadMoreFailed) {
      return (
        <View style={styles.footer}>
          <ErrorState compact message="No hemos podido traer más perfiles." onRetry={onLoadMore} testID="feed-more-error" />
        </View>
      );
    }

    if (hasMore || loadingMore) {
      return (
        <View style={styles.footer}>
          <FeedPostSkeleton width={width} />
        </View>
      );
    }

    return (
      <View style={styles.footer} testID="feed-end">
        <Stack align="center" gap="sm">
          <Mascot mood="sleepy" size={84} />
          <Text align="center" variant="title3">
            Has llegado al final 🌸
          </Text>
          <Text align="center" color="muted" variant="callout">
            Vuelve en un rato o amplía tus filtros.
          </Text>
        </Stack>
      </View>
    );
  }, [hasMore, loadMoreFailed, loadingMore, onLoadMore, rows.length, width]);

  return (
    <View onLayout={onLayout} style={styles.root} testID="discover-feed">
      {width > 0 ? (
        <FlashList
          ref={listRef}
          ListEmptyComponent={
            (loadingMore || hasMore) && !loadMoreFailed ? (
              <View style={styles.footer}>
                <FeedPostSkeleton width={width} />
              </View>
            ) : (
              <View style={styles.empty}>
                <DiscoverEmpty onRetry={onRetry} onWidenFilters={onWidenFilters} />
              </View>
            )
          }
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: bottomSpace + 24 }}
          data={rows}
          drawDistance={900}
          extraData={leaving}
          keyExtractor={(row) => row.card.id}
          onEndReached={onLoadMore}
          onEndReachedThreshold={1.5}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={VIEWABILITY_CONFIG}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  footer: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 12
  },
  empty: {
    paddingHorizontal: 20,
    paddingTop: 40
  }
});

