import { useCallback, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";

import type { DiscoveryActionType, DiscoveryProfileCard } from "@cherry/contracts";

import type { DiscoveryQueueRemoval, DiscoveryQueueReturn } from "../../application/discovery-queue";
import { describePerson } from "../describe-person";
import { DeckSkeleton, DiscoverEmpty } from "../discover-states";
import { POLAROID_MARGIN, SwipeCardFace, swipeFooterHit, swipePhotoHeight } from "./swipe-card-face";
import { SwipeDeck, type SwipeDeckHandle } from "./swipe-deck";

/** Hueco bajo la card de arriba para que asomen las de detrás. */
const PEEK = 26;
const MAX_CARD_WIDTH = 460;

interface SwipeModeProps {
  profiles: DiscoveryProfileCard[];
  /** Esperando más perfiles con la pila vacía (skeleton). */
  waiting: boolean;
  /** No hay más perfiles (estado vacío). */
  exhausted: boolean;
  loadMoreFailed: boolean;
  undoing: boolean;
  /** Falso tras recargar por filtros: el último «no» ya no se puede recuperar. */
  canUndo: boolean;
  focused: boolean;
  reducedMotion: boolean;
  lastReturn: DiscoveryQueueReturn | null;
  lastRemoval: DiscoveryQueueRemoval | null;
  bottomSpace: number;
  onDecide(card: DiscoveryProfileCard, action: DiscoveryActionType): void;
  onUndo(): void;
  onOpen(card: DiscoveryProfileCard): void;
  onWidenFilters(): void;
  onRetry(): void;
}

export function SwipeMode({
  profiles,
  waiting,
  exhausted,
  loadMoreFailed,
  undoing,
  canUndo,
  focused,
  reducedMotion,
  lastReturn,
  lastRemoval,
  bottomSpace,
  onDecide,
  onUndo,
  onOpen,
  onWidenFilters,
  onRetry
}: SwipeModeProps) {
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }
    );
  }, []);

  const cardWidth = box ? Math.min(box.width, MAX_CARD_WIDTH) : 0;
  const cardHeight = box ? Math.max(box.height - PEEK, 320) : 0;
  const photoArea = POLAROID_MARGIN + swipePhotoHeight(cardHeight);
  const empty = profiles.length === 0;
  const undoAvailable = canUndo && !undoing;

  const hitTest = useCallback(
    (x: number, y: number) => swipeFooterHit(x, y, cardWidth, cardHeight),
    [cardHeight, cardWidth]
  );
  const undo = useCallback(() => {
    if (undoAvailable) onUndo();
  }, [onUndo, undoAvailable]);

  const renderCard = useCallback(
    (card: DiscoveryProfileCard, info: { photoIndex: number; isTop: boolean; flying: boolean }) => (
      <SwipeCardFace
        canUndo={undoAvailable}
        card={card}
        flying={info.flying}
        height={cardHeight}
        isTop={info.isTop}
        photoIndex={info.photoIndex}
        width={cardWidth}
      />
    ),
    [cardHeight, cardWidth, undoAvailable]
  );

  return (
    <View style={[styles.root, { paddingBottom: bottomSpace + 12 }]} testID="discover-swipe">
      <View onLayout={onLayout} style={styles.deckArea}>
        {box ? (
          empty ? (
            waiting ? (
              <DeckSkeleton height={cardHeight} width={cardWidth} />
            ) : exhausted || loadMoreFailed ? (
              <View style={[styles.emptyWrap, { width: cardWidth, height: cardHeight }]}>
                <DiscoverEmpty onRetry={onRetry} onWidenFilters={onWidenFilters} />
              </View>
            ) : (
              <DeckSkeleton height={cardHeight} width={cardWidth} />
            )
          ) : (
            <SwipeDeck
              ref={deckRef}
              cards={profiles}
              describe={describePerson}
              focused={focused}
              height={cardHeight}
              lastRemoval={lastRemoval}
              lastReturn={lastReturn}
              hitTest={hitTest}
              onDecide={onDecide}
              onOpen={onOpen}
              onUndo={undo}
              photoAreaHeight={photoArea}
              reducedMotion={reducedMotion}
              renderCard={renderCard}
              width={cardWidth}
            />
          )
        ) : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  deckArea: {
    flex: 1,
    marginHorizontal: 20,
    // Aire bajo la cabecera: las cintas de washi de la card suben ~10 pt.
    marginTop: 22,
    alignItems: "center"
  },
  emptyWrap: {
    justifyContent: "center"
  }
});
