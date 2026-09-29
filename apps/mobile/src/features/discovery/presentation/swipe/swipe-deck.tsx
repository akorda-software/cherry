import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { StyleSheet, View } from "react-native";
import { runOnUI, useSharedValue, withSpring } from "react-native-reanimated";

import type { DiscoveryActionType, DiscoveryProfileCard } from "@snack/contracts";

import { springs } from "../../../../shared/ui/motion";
import type { DiscoveryQueueRemoval, DiscoveryQueueReturn } from "../../application/discovery-queue";
import { classifyDeckOrderChange, nextResidual } from "../../domain/deck-order";
import {
  SwipeCard,
  type SwipeCardHandle,
  type SwipeCardRenderInfo,
  type SwipeExitMode,
  type SwipeFlight
} from "./swipe-card";

/** Cards que se pintan a la vez (la de arriba y dos asomando detrás). */
const VISIBLE_CARDS = 3;
/** Red de seguridad por si una animación de salida no avisa al terminar. */
const FLIGHT_TIMEOUT_MS = 1600;

export interface SwipeDeckHandle {
  /** Lanza la card de arriba (botones ✕ / ♥): misma animación que el gesto. */
  swipe(action: DiscoveryActionType): boolean;
}

interface FlyingCard {
  card: DiscoveryProfileCard;
  flight: SwipeFlight;
}

interface SwipeDeckProps {
  cards: DiscoveryProfileCard[];
  width: number;
  height: number;
  photoAreaHeight: number;
  /** Descubrir está a la vista (las salidas externas esperan a que vuelvas). */
  focused: boolean;
  reducedMotion: boolean;
  lastReturn: DiscoveryQueueReturn | null;
  lastRemoval: DiscoveryQueueRemoval | null;
  describe(card: DiscoveryProfileCard): string;
  onDecide(card: DiscoveryProfileCard, action: DiscoveryActionType): void;
  onOpen(card: DiscoveryProfileCard): void;
  renderCard(card: DiscoveryProfileCard, info: SwipeCardRenderInfo): ReactNode;
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  {
    cards,
    width,
    height,
    photoAreaHeight,
    focused,
    reducedMotion,
    lastReturn,
    lastRemoval,
    describe,
    onDecide,
    onOpen,
    renderCard
  },
  ref
) {
  const order = useSharedValue<string[]>([]);
  const progress = useSharedValue(0);
  const residual = useSharedValue(0);
  const topRef = useRef<SwipeCardHandle>(null);
  const [flying, setFlying] = useState<FlyingCard[]>([]);
  const flyingIds = useMemo(() => new Set(flying.map((item) => item.card.id)), [flying]);

  const visible = useMemo(
    () => cards.filter((card) => !flyingIds.has(card.id)).slice(0, VISIBLE_CARDS),
    [cards, flyingIds]
  );

  // Cards que VUELVEN a la cola mientras aún volaban (fallo de red): dejan de volar.
  // `departed` evita confundirlas con las recién decididas, que siguen en la cola un render.
  const departed = useRef(new Set<string>());
  useEffect(() => {
    const queued = new Set(cards.map((card) => card.id));

    for (const item of flying) {
      if (!queued.has(item.card.id)) {
        departed.current.add(item.card.id);
      }
    }

    const returned = flying.filter((item) => departed.current.has(item.card.id) && queued.has(item.card.id));

    if (returned.length > 0) {
      returned.forEach((item) => departed.current.delete(item.card.id));
      setFlying((current) => current.filter((item) => !returned.some((back) => back.card.id === item.card.id)));
    }
  }, [cards, flying]);

  // Salidas que no nacen del gesto ni de los botones (perfil completo, bloqueo, deshacer fallido).
  const previousVisible = useRef<DiscoveryProfileCard[]>([]);
  const committedIds = useRef(new Set<string>());
  useLayoutEffect(() => {
    const now = new Set(cards.map((card) => card.id));
    const vanished = previousVisible.current.filter(
      (card) => !now.has(card.id) && !committedIds.current.has(card.id)
    );

    if (vanished.length > 0) {
      setFlying((current) => [
        ...current,
        ...vanished
          .filter((card) => !current.some((item) => item.card.id === card.id))
          .map((card) => ({
            card,
            flight: {
              action: lastRemoval?.profileId === card.id ? lastRemoval.action : null,
              mode: "external" as const,
              armed: focused
            }
          }))
      ]);
    }

    for (const id of committedIds.current) {
      if (now.has(id)) {
        // Volvió (rollback / deshacer): puede volver a salir más tarde.
        committedIds.current.delete(id);
      }
    }

    previousVisible.current = visible;
  }, [cards, focused, lastRemoval, visible]);

  // Las salidas externas se disparan al volver a Descubrir.
  useEffect(() => {
    if (!focused) {
      return;
    }

    if (flying.some((item) => !item.flight.armed)) {
      setFlying((current) =>
        current.map((item) => (item.flight.armed ? item : { ...item, flight: { ...item.flight, armed: true } }))
      );
    }
  }, [flying, focused]);

  // Sincroniza el orden visible con el hilo de UI sin saltos (ver deck-order.ts).
  const visibleKey = visible.map((card) => card.id).join("|");
  useLayoutEffect(() => {
    const ids = visibleKey === "" ? [] : visibleKey.split("|");

    runOnUI((next: string[]) => {
      "worklet";
      const change = classifyDeckOrderChange(order.value, next);
      const residualNow = nextResidual(change, residual.value, progress.value);
      progress.value = 0;
      order.value = next;

      if (change === "reset" || change === "same") {
        residual.value = change === "reset" ? 0 : residual.value;
        return;
      }

      residual.value = residualNow;
      residual.value = withSpring(0, springs.soft);
    })(ids);
  }, [order, progress, residual, visibleKey]);

  // Red de seguridad: ninguna card se queda «volando» para siempre.
  useEffect(() => {
    if (flying.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setFlying((current) => current.filter((item) => !item.flight.armed));
    }, FLIGHT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [flying]);

  // La decisión se entrega a la cola DESPUÉS de que la card pase a «volando»: así nunca
  // se desmonta a mitad de animación (la cola y este estado se pintan en pasadas distintas).
  const pendingDecisions = useRef<Array<{ card: DiscoveryProfileCard; action: DiscoveryActionType }>>([]);

  const handleCommit = useCallback((card: DiscoveryProfileCard, action: DiscoveryActionType, mode: SwipeExitMode) => {
    committedIds.current.add(card.id);
    pendingDecisions.current.push({ card, action });
    setFlying((current) =>
      current.some((item) => item.card.id === card.id)
        ? [...current]
        : [...current, { card, flight: { action, mode, armed: true } }]
    );
  }, []);

  useEffect(() => {
    if (pendingDecisions.current.length === 0) {
      return;
    }

    const decisions = pendingDecisions.current;
    pendingDecisions.current = [];
    decisions.forEach(({ card, action }) => onDecide(card, action));
  }, [flying, onDecide]);

  const handleExited = useCallback((profileId: string) => {
    committedIds.current.delete(profileId);
    departed.current.delete(profileId);
    setFlying((current) => current.filter((item) => item.card.id !== profileId));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      swipe(action) {
        return topRef.current?.fling(action) ?? false;
      }
    }),
    []
  );

  // Entrada animada solo para la card que vuelve ahora mismo (deshacer / fallo al guardar).
  const handledReturn = useRef<number>(0);
  const enterFor = (card: DiscoveryProfileCard): DiscoveryActionType | null => {
    if (lastReturn && lastReturn.profileId === card.id && lastReturn.seq > handledReturn.current) {
      return lastReturn.action;
    }

    return null;
  };

  useEffect(() => {
    if (lastReturn) {
      handledReturn.current = Math.max(handledReturn.current, lastReturn.seq);
    }
  }, [lastReturn]);

  // Un único array con claves estables: una card que pasa de la pila a «volando» conserva
  // su instancia (y sus valores animados) en vez de montarse de nuevo.
  const items: Array<{ card: DiscoveryProfileCard; index: number; flight: SwipeFlight | null }> = [
    ...[...visible].reverse().map((card) => ({ card, index: visible.indexOf(card), flight: null })),
    ...flying.map(({ card, flight }) => ({ card, index: -1, flight }))
  ];

  return (
    <View style={[styles.deck, { width, height }]} testID="swipe-deck">
      {items.map(({ card, index, flight }) => (
        <SwipeCard
          key={card.id}
          ref={index === 0 ? topRef : undefined}
          accessibilityLabel={describe(card)}
          card={card}
          enterFrom={index === 0 ? enterFor(card) : null}
          flight={flight}
          height={height}
          index={index}
          onCommit={handleCommit}
          onExited={handleExited}
          onOpen={onOpen}
          order={order}
          photoAreaHeight={photoAreaHeight}
          progress={progress}
          reducedMotion={reducedMotion}
          residual={residual}
          width={width}
        >
          {(info) => renderCard(card, info)}
        </SwipeCard>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  deck: {
    position: "relative"
  }
});
