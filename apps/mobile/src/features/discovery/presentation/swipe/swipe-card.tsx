import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { type AccessibilityActionEvent, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import type { DiscoveryActionType, DiscoveryProfileCard } from "@cherry/contracts";

import { haptics, springs } from "../../../../shared/ui/motion";
import { decideSwipe, deckPosition, restingTilt, swipeProgress, swipeThreshold } from "../../domain/deck-order";
import { SwipeOpenHint, SwipeStamps } from "./swipe-stamps";

export type SwipeExitMode = "gesture" | "button" | "external";

export interface SwipeFlight {
  /** `null`: sale sin decisión (bloqueo, deshacer fallido) → se desvanece. */
  action: DiscoveryActionType | null;
  mode: SwipeExitMode;
  /** Las salidas externas esperan a que Descubrir vuelva a estar a la vista. */
  armed: boolean;
}

export interface SwipeCardHandle {
  /** Lanza la card como si fuera el gesto (botones ✕ / ♥). `false` si no puede. */
  fling(action: DiscoveryActionType): boolean;
}

export interface SwipeCardRenderInfo {
  photoIndex: number;
  isTop: boolean;
  /** Ya decidida y saliendo de la pila. */
  flying: boolean;
}

interface SwipeCardProps {
  card: DiscoveryProfileCard;
  /** Puesto en la pila visible (0 = arriba); -1 si está volando. */
  index: number;
  width: number;
  height: number;
  /** Alto de la zona de foto: los toques ahí cambian de foto; por debajo abren el perfil. */
  photoAreaHeight: number;
  order: SharedValue<string[]>;
  progress: SharedValue<number>;
  residual: SharedValue<number>;
  flight: SwipeFlight | null;
  /** Al montarse: entra desde el lado de esta acción (deshacer / fallo al guardar). */
  enterFrom: DiscoveryActionType | null;
  reducedMotion: boolean;
  accessibilityLabel: string;
  onCommit(card: DiscoveryProfileCard, action: DiscoveryActionType, mode: SwipeExitMode): void;
  onExited(profileId: string): void;
  onOpen(card: DiscoveryProfileCard): void;
  /** Botón del pie que hay en (x, y) (solo pintan: los toques se resuelven aquí). */
  hitTest?(x: number, y: number): "like" | "dislike" | "undo" | "open" | null;
  /** «↺» del pie: recupera el último «no». */
  onUndo?(): void;
  children(info: SwipeCardRenderInfo): ReactNode;
}

const MAX_ROTATION = 13;
const LIFT_SCALE = 0.018;

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  {
    card,
    index,
    width,
    height,
    photoAreaHeight,
    order,
    progress,
    residual,
    flight,
    enterFrom,
    reducedMotion,
    accessibilityLabel,
    onCommit,
    onExited,
    onOpen,
    hitTest,
    onUndo,
    children
  },
  ref
) {
  const isTop = index === 0 && flight === null;
  const photoCount = Math.max(card.photos.length, card.photoUrl ? 1 : 0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const tilt = useMemo(() => restingTilt(card.id), [card.id]);
  const threshold = swipeThreshold(width);
  const exitDistance = width * 1.25 + height * 0.35;

  const initialX = enterFrom === null || reducedMotion ? 0 : (enterFrom === "like" ? 1 : -1) * exitDistance;
  const tx = useSharedValue(initialX);
  const ty = useSharedValue(enterFrom === null || reducedMotion ? 0 : -24);
  const lift = useSharedValue(0);
  const nudge = useSharedValue(0);
  const fade = useSharedValue(enterFrom !== null && reducedMotion ? 0 : 1);
  const committed = useSharedValue(0);
  const armed = useSharedValue(0);
  const stampForce = useSharedValue(0);
  const stampKick = useSharedValue(1);
  const openKick = useSharedValue(0);

  // Entrada de una card que vuelve (deshacer / fallo): la animación inversa de su salida.
  useEffect(() => {
    if (enterFrom === null) {
      return;
    }

    if (reducedMotion) {
      fade.value = withTiming(1, { duration: 180 });
      return;
    }

    tx.value = withSpring(0, springs.soft);
    ty.value = withSpring(0, springs.soft);
    // Solo al montar: la entrada no se repite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExited = useCallback(() => onExited(card.id), [card.id, onExited]);

  const throwCard = useCallback(
    (action: DiscoveryActionType | null, mode: SwipeExitMode, vx: number, vy: number) => {
      "worklet";

      if (committed.value === 1) {
        return;
      }

      committed.value = 1;
      armed.value = 0;

      if (order.value[0] === card.id) {
        progress.value = withTiming(1, { duration: 220 });
      }

      if (action !== null && mode !== "gesture") {
        stampForce.value = action === "like" ? 1 : -1;
        stampKick.value = withSequence(withTiming(1.55, { duration: 0 }), withSpring(1, springs.pop));
      }

      const done = (finished?: boolean) => {
        "worklet";

        if (finished) {
          runOnJS(handleExited)();
        }
      };

      if (action === null || reducedMotion) {
        fade.value = withDelay(action === null ? 0 : 140, withTiming(0, { duration: 180 }, done));
        return;
      }

      const direction = action === "like" ? 1 : -1;
      const target = direction * exitDistance;

      if (mode === "gesture") {
        const speed = Math.max(Math.abs(vx), 1300);
        const duration = Math.min(Math.max((Math.abs(target - tx.value) / speed) * 1000, 170), 380);
        tx.value = withTiming(target, { duration, easing: Easing.out(Easing.quad) }, done);
        ty.value = withTiming(ty.value + vy * 0.12, { duration, easing: Easing.out(Easing.quad) });
        return;
      }

      // Botón o salida externa: el sello cae primero y la card se lanza acelerando.
      tx.value = withDelay(60, withTiming(target, { duration: 300, easing: Easing.bezier(0.5, 0, 0.75, 0.35) }, done));
      ty.value = withDelay(60, withTiming(-36, { duration: 300, easing: Easing.out(Easing.quad) }));
    },
    [
      armed,
      card.id,
      committed,
      exitDistance,
      fade,
      handleExited,
      order,
      progress,
      reducedMotion,
      stampForce,
      stampKick,
      tx,
      ty
    ]
  );

  /**
   * «Ya saliendo» en el hilo JS: `isTop` no cambia hasta el siguiente render, así que dos
   * pulsaciones rápidas en ✕/♥ lanzarían la misma card dos veces sin esta marca.
   */
  const leaving = useRef(false);

  // Salidas que no nacen de esta card (acción desde el perfil completo, bloqueo…).
  const wasFlying = useRef(flight !== null);
  useEffect(() => {
    if (flight === null) {
      if (wasFlying.current) {
        // Volvió a la cola mientras volaba (fallo de red): regresa a su sitio.
        wasFlying.current = false;
        leaving.current = false;
        runOnUI(() => {
          "worklet";
          committed.value = 0;
          stampForce.value = 0;
          cancelAnimation(tx);
          cancelAnimation(ty);
          tx.value = withSpring(0, springs.soft);
          ty.value = withSpring(0, springs.soft);
          fade.value = withTiming(1, { duration: 160 });
        })();
      }
      return;
    }

    wasFlying.current = true;

    if (flight.mode === "external" && flight.armed) {
      runOnUI(throwCard)(flight.action, "external", 0, 0);
    }
  }, [committed, fade, flight, stampForce, throwCard, tx, ty]);

  const commitFromGesture = useCallback(
    (action: DiscoveryActionType) => {
      if (leaving.current) {
        return;
      }

      leaving.current = true;

      if (action === "like") {
        haptics.medium();
      } else {
        haptics.light();
      }

      onCommit(card, action, "gesture");
    },
    [card, onCommit]
  );

  const openFromGesture = useCallback(() => onOpen(card), [card, onOpen]);
  // Hápticos desde el hilo de UI: funciones JS locales y estables para `runOnJS`.
  const thresholdHaptic = useCallback(() => haptics.light(), []);
  const openHaptic = useCallback(() => haptics.selection(), []);

  const photoIndexRef = useRef(0);
  photoIndexRef.current = photoIndex;

  const stepPhoto = useCallback(
    (delta: 1 | -1) => {
      const next = photoIndexRef.current + delta;

      if (next < 0 || next >= photoCount) {
        // En la primera/última foto: un toquecito de «no hay más».
        runOnUI(() => {
          "worklet";
          nudge.value = withSequence(withTiming(delta * 7, { duration: 70 }), withSpring(0, springs.snappy));
        })();
        return;
      }

      photoIndexRef.current = next;
      setPhotoIndex(next);
    },
    [nudge, photoCount]
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      const target = hitTest?.(x, y) ?? null;
      if (target === "like" || target === "dislike") {
        if (leaving.current) return;
        leaving.current = true;
        if (target === "like") haptics.medium();
        else haptics.light();
        runOnUI(throwCard)(target, "button", 0, 0);
        onCommit(card, target, "button");
        return;
      }
      if (target === "undo") {
        onUndo?.();
        return;
      }

      if (target === "open" || y > photoAreaHeight) {
        onOpen(card);
        return;
      }

      stepPhoto(x < width / 2 ? -1 : 1);
    },
    [card, hitTest, onCommit, onOpen, onUndo, photoAreaHeight, stepPhoto, throwCard, width]
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(isTop)
      .activeOffsetX([-10, 10])
      .activeOffsetY([-10, 10])
      .onBegin(() => {
        lift.value = withSpring(1, springs.snappy);
      })
      .onUpdate((event) => {
        if (committed.value === 1) {
          return;
        }

        tx.value = event.translationX;
        // Hacia abajo cuesta (fricción); hacia arriba sigue al dedo para abrir el perfil.
        ty.value = event.translationY > 0 ? event.translationY * 0.3 : event.translationY;
        progress.value = swipeProgress(event.translationX, width);

        const side = event.translationX >= threshold ? 1 : event.translationX <= -threshold ? -1 : 0;

        if (side !== armed.value) {
          armed.value = side;

          if (side !== 0) {
            stampKick.value = withSequence(withTiming(1.18, { duration: 70 }), withSpring(1, springs.pop));
            runOnJS(thresholdHaptic)();
          }
        }

        const opening = -event.translationY > 110 && Math.abs(event.translationX) < 80 ? 1 : 0;

        if (opening !== openKick.value) {
          openKick.value = opening;

          if (opening === 1) {
            runOnJS(openHaptic)();
          }
        }
      })
      .onEnd((event) => {
        if (committed.value === 1) {
          return;
        }

        const decision = decideSwipe({
          translationX: event.translationX,
          translationY: event.translationY,
          velocityX: event.velocityX,
          velocityY: event.velocityY,
          width
        });

        if (decision === "like" || decision === "dislike") {
          throwCard(decision, "gesture", event.velocityX, event.velocityY);
          runOnJS(commitFromGesture)(decision);
          return;
        }

        if (decision === "open") {
          // El papel sigue subiendo mientras el perfil completo sube desde abajo.
          ty.value = withTiming(ty.value - 90, { duration: 200, easing: Easing.out(Easing.quad) }, () => {
            tx.value = withDelay(260, withSpring(0, springs.soft));
            ty.value = withDelay(260, withSpring(0, springs.soft));
          });
          progress.value = withSpring(0, springs.soft);
          armed.value = 0;
          openKick.value = 0;
          runOnJS(openFromGesture)();
          return;
        }

        tx.value = withSpring(0, { ...springs.soft, velocity: event.velocityX });
        ty.value = withSpring(0, { ...springs.soft, velocity: event.velocityY });
        progress.value = withSpring(0, springs.soft);
        armed.value = 0;
        openKick.value = 0;
      })
      .onFinalize(() => {
        lift.value = withSpring(0, springs.snappy);
      });

    const tap = Gesture.Tap()
      .enabled(isTop)
      .maxDistance(10)
      .maxDuration(400)
      .onEnd((event, success) => {
        if (success) {
          runOnJS(handleTap)(event.x, event.y);
        }
      });

    return Gesture.Race(pan, tap);
  }, [
    armed,
    commitFromGesture,
    committed,
    handleTap,
    isTop,
    lift,
    openFromGesture,
    openHaptic,
    openKick,
    progress,
    stampKick,
    threshold,
    thresholdHaptic,
    throwCard,
    tx,
    ty,
    width
  ]);

  useImperativeHandle(
    ref,
    () => ({
      fling(action) {
        if (!isTop || leaving.current) {
          return false;
        }

        leaving.current = true;

        if (action === "like") {
          haptics.medium();
        } else {
          haptics.light();
        }

        runOnUI(throwCard)(action, "button", 0, 0);
        onCommit(card, action, "button");
        return true;
      }
    }),
    [card, isTop, onCommit, throwCard]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const position = order.value.indexOf(card.id);
    const flyingNow = position === -1;
    const stackPosition = flyingNow ? 0 : deckPosition(position, residual.value, progress.value);
    const scale = interpolate(stackPosition, [0, 1, 2, 3], [1, 0.96, 0.925, 0.9], Extrapolation.CLAMP);
    const offsetY = interpolate(stackPosition, [0, 1, 2, 3], [0, 24, 42, 54], Extrapolation.CLAMP);
    const resting = tilt * Math.min(stackPosition, 1);
    const moving = flyingNow || position === 0;
    const rotation = moving
      ? interpolate(tx.value, [-width, 0, width], [-MAX_ROTATION, 0, MAX_ROTATION], Extrapolation.EXTEND)
      : 0;

    return {
      opacity: fade.value,
      transform: [
        { translateX: (moving ? tx.value : 0) + nudge.value },
        { translateY: (moving ? ty.value : 0) + offsetY },
        { rotate: `${rotation + resting}deg` },
        { scale: scale * (1 + lift.value * LIFT_SCALE) }
      ]
    };
  });

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      switch (event.nativeEvent.actionName) {
        case "like":
        case "dislike": {
          const action = event.nativeEvent.actionName;
          runOnUI(throwCard)(action, "button", 0, 0);
          onCommit(card, action, "button");
          break;
        }
        case "open":
        case "activate":
          onOpen(card);
          break;
        case "nextPhoto":
          stepPhoto(1);
          break;
        case "previousPhoto":
          stepPhoto(-1);
          break;
        default:
          break;
      }
    },
    [card, onCommit, onOpen, stepPhoto, throwCard]
  );

  const accessibilityActions = useMemo(
    () => [
      { name: "like", label: "Me gusta" },
      { name: "dislike", label: "Paso" },
      { name: "open", label: "Ver perfil completo" },
      ...(photoCount > 1
        ? [
            { name: "nextPhoto", label: "Foto siguiente" },
            { name: "previousPhoto", label: "Foto anterior" }
          ]
        : [])
    ],
    [photoCount]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible={isTop}
        accessibilityActions={isTop ? accessibilityActions : undefined}
        accessibilityElementsHidden={!isTop}
        accessibilityHint={
          isTop
            ? "Desliza a la derecha si te gusta, a la izquierda para pasar o hacia arriba para ver su perfil."
            : undefined
        }
        accessibilityLabel={isTop ? accessibilityLabel : undefined}
        importantForAccessibility={isTop ? "yes" : "no-hide-descendants"}
        onAccessibilityAction={onAccessibilityAction}
        pointerEvents={isTop ? "auto" : "none"}
        style={[styles.card, { width, height }, animatedStyle]}
        testID={isTop ? "swipe-card-top" : `swipe-card-${card.id}`}
      >
        {children({ photoIndex, isTop, flying: flight !== null })}
        <SwipeStamps
          armed={armed}
          force={stampForce}
          kick={stampKick}
          photoAreaHeight={photoAreaHeight}
          threshold={threshold}
          tx={tx}
        />
        {isTop ? <SwipeOpenHint photoAreaHeight={photoAreaHeight} tx={tx} ty={ty} /> : null}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 0
  }
});
