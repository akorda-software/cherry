import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import type { IconName } from "../art";
import { haptics } from "../motion/haptics";
import { springs } from "../motion/springs";
import { IconSlot } from "../primitives/icon-slot";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";
import type { AppTheme } from "../themes/theme-types";

export type ToastTone = "neutral" | "success" | "error" | "info" | "warning" | "love";

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Icono del set (por defecto, según el tono). */
  icon?: IconName;
  /** ms visible (por defecto 3 s; errores 4,5 s). */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "icon">> {
  id: number;
  icon?: IconName;
}

interface ToastState {
  current: ToastItem | null;
  queue: ToastItem[];
  show(options: ToastOptions): void;
  /** Quita el aviso actual y pasa al siguiente. */
  next(): void;
  clear(): void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  queue: [],
  show: (options) => {
    const tone = options.tone ?? "neutral";
    const item: ToastItem = {
      id: nextId++,
      message: options.message,
      tone,
      icon: options.icon,
      duration: options.duration ?? (tone === "error" ? 4500 : 3000)
    };
    set((state) => (state.current ? { queue: [...state.queue, item] } : { current: item }));
  },
  next: () => set((state) => ({ current: state.queue[0] ?? null, queue: state.queue.slice(1) })),
  clear: () => set({ current: null, queue: [] })
}));

/** API imperativa: `toast.show({ message, tone })` desde cualquier sitio. */
export const toast = {
  show: (options: ToastOptions) => useToastStore.getState().show(options),
  clear: () => useToastStore.getState().clear()
};

/** `const { show } = useToast(); show({ message: "Guardado", tone: "success" })`. */
export function useToast() {
  return useMemo(() => ({ show: toast.show, clear: toast.clear }), []);
}

const defaultIcons: Record<ToastTone, IconName> = {
  neutral: "sparkle",
  success: "check-circle",
  error: "alert",
  info: "info",
  warning: "alert",
  love: "heart"
};

function toneFill(theme: AppTheme, tone: ToastTone) {
  const p = theme.primitives.pastel;
  switch (tone) {
    case "success":
      return p.menta.fill;
    case "error":
      return p.tomate.fill;
    case "info":
      return p.cielo.fill;
    case "warning":
      return p.limonada.fill;
    case "love":
      return p.fresa.fill;
    default:
      return theme.primitives.color.white;
  }
}

/**
 * Monta una vez en la raíz. Los avisos llegan desde arriba como una pegatina
 * torcida, se quedan un momento y se van solos (toca o desliza hacia arriba
 * para quitarlos antes).
 */
export function ToastHost() {
  const current = useToastStore((state) => state.current);

  if (!current) {
    return null;
  }

  return <ToastSticker item={current} key={current.id} />;
}

function ToastSticker({ item }: { item: ToastItem }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const next = useToastStore((state) => state.next);
  const y = useSharedValue(reduced ? 0 : -140);
  const opacity = useSharedValue(0);
  const turn = useSharedValue(reduced ? -1.5 : -7);
  const leaving = useRef(false);
  const [exiting, setExiting] = useState(false);
  /** En salida: el arrastre ya no puede tocar `y` (cancelaría la animación y el relevo). */
  const exitingValue = useSharedValue(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pasa al siguiente aviso una sola vez y solo si este sigue siendo el actual.
  const advance = useCallback(() => {
    if (fallback.current) {
      clearTimeout(fallback.current);
      fallback.current = null;
    }
    if (useToastStore.getState().current?.id === item.id) {
      next();
    }
  }, [item.id, next]);

  function leave() {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    exitingValue.value = true;
    setExiting(true);
    // Aunque la salida se interrumpa (`finished === false`), el relevo ocurre igual.
    const finish = () => {
      "worklet";
      runOnJS(advance)();
    };
    opacity.value = withTiming(0, { duration: 180 });
    y.value = reduced ? 0 : withTiming(-110, { duration: 200 }, finish);
    // Respaldo (y camino normal con movimiento reducido).
    fallback.current = setTimeout(advance, reduced ? 190 : 400);
  }

  useEffect(() => {
    opacity.value = withTiming(1, { duration: theme.primitives.motion.quick });
    if (!reduced) {
      y.value = withSpring(0, springs.pop);
      turn.value = withSpring(-1.5, springs.pop);
    }
    if (item.tone === "error") {
      haptics.error();
    } else if (item.tone === "success") {
      haptics.success();
    }
    if (Platform.OS !== "web") {
      AccessibilityInfo.announceForAccessibility(item.message);
    }

    const timer = setTimeout(leave, item.duration);
    return () => {
      clearTimeout(timer);
      if (fallback.current) {
        clearTimeout(fallback.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipe = Gesture.Pan()
    .enabled(!exiting)
    .activeOffsetY([-6, 6])
    .onUpdate((event) => {
      if (exitingValue.value) {
        return;
      }
      y.value = event.translationY < 0 ? event.translationY : event.translationY * 0.2;
    })
    .onEnd((event) => {
      if (exitingValue.value) {
        return;
      }
      if (event.translationY < -24 || event.velocityY < -500) {
        runOnJS(leave)();
      } else {
        y.value = withSpring(0, springs.snappy);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { rotate: `${turn.value}deg` }]
  }));

  const c = theme.primitives.color;

  return (
    <View style={[styles.host, { top: insets.top + 8 }]}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.wrap, animatedStyle]}>
          <View style={[styles.shadow, { backgroundColor: c.ink, borderRadius: theme.primitives.radius.lg }]} />
          <Pressable
            accessibilityHint="Toca para cerrar"
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            onPress={leave}
            style={[
              styles.toast,
              {
                backgroundColor: toneFill(theme, item.tone),
                borderColor: c.ink,
                borderWidth: theme.primitives.border.regular,
                borderRadius: theme.primitives.radius.lg
              }
            ]}
            testID="toast"
          >
            <View style={[styles.icon, { backgroundColor: c.white, borderColor: c.ink, borderWidth: theme.primitives.border.thin }]}>
              <IconSlot color={c.ink} icon={item.icon ?? defaultIcons[item.tone]} size={18} />
            </View>
            <Text style={styles.message} variant="bodyStrong">
              {item.message}
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 1000,
    pointerEvents: "box-none"
  },
  wrap: {
    maxWidth: 480,
    alignSelf: "stretch"
  },
  shadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4
  },
  toast: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  message: {
    flex: 1
  }
});
