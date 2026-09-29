import { type ReactNode, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { springs } from "../motion/springs";
import { IconButton } from "../primitives/icon-button";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";

export interface SheetProps {
  visible: boolean;
  /** Cerrar: velo, arrastre hacia abajo, ✕ y botón/gesto atrás de Android. */
  onClose(): void;
  title?: string;
  /** auto = alto del contenido (máx. 90 %) · tall = 90 % de la pantalla. */
  snap?: "auto" | "tall";
  children?: ReactNode;
  /** Acciones fijas al pie de la hoja. */
  footer?: ReactNode;
  /** Muestra ✕ en la cabecera (por defecto, si hay título). */
  showClose?: boolean;
  /** Se puede cerrar tocando fuera, arrastrando o con atrás (por defecto sí). */
  dismissible?: boolean;
  /** Contenido desplazable (por defecto sí). */
  scroll?: boolean;
  testID?: string;
}

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;
/** El papel sigue por debajo del borde para que un rebote no deje hueco. */
const OVERHANG = 80;

/**
 * Hoja inferior: sube como una hoja de papel sobre un velo de tinta. Se
 * cierra arrastrándola hacia abajo, tocando el velo, con ✕ o con atrás.
 */
export function Sheet({
  visible,
  onClose,
  title,
  snap = "auto",
  children,
  footer,
  showClose,
  dismissible = true,
  scroll = true,
  testID
}: SheetProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const offscreen = windowHeight;
  const y = useSharedValue(offscreen);
  const veil = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (visible) {
      veil.value = withTiming(1, { duration: theme.primitives.motion.calm });
      if (reduced) {
        y.value = 0;
      } else {
        y.value = offscreen;
        y.value = withTiming(0, { duration: 380, easing: DRAWER });
      }
    } else {
      const done = (finished?: boolean) => {
        "worklet";
        if (finished) {
          runOnJS(setMounted)(false);
        }
      };
      veil.value = withTiming(0, { duration: 200 });
      y.value = reduced ? offscreen : withTiming(offscreen, { duration: 240, easing: DRAWER }, done);
      if (reduced) {
        setMounted(false);
      }
    }
  }, [mounted, offscreen, reduced, theme.primitives.motion.calm, veil, visible, y]);

  const drag = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      y.value = event.translationY > 0 ? event.translationY : event.translationY * 0.15;
    })
    .onEnd((event) => {
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
        runOnJS(onClose)();
      } else {
        y.value = withSpring(0, springs.snappy);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  const maxHeight = windowHeight * 0.9;
  const closeButton = showClose ?? Boolean(title);

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={dismissible ? onClose : () => undefined}
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.semantic.color.scrim }, veilStyle]}>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            disabled={!dismissible}
            onPress={onClose}
            style={styles.flex}
            testID={testID ? `${testID}-scrim` : undefined}
          />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" style={styles.bottom}>
          <Animated.View
            accessibilityViewIsModal
            aria-modal
            role="dialog"
            aria-label={title}
            style={[
              styles.sheet,
              {
                maxHeight: maxHeight + OVERHANG,
                height: snap === "tall" ? maxHeight + OVERHANG : undefined,
                marginBottom: -OVERHANG,
                paddingBottom: OVERHANG + Math.max(insets.bottom, 12) + 8,
                backgroundColor: c.white,
                borderColor: c.ink,
                borderWidth: theme.primitives.border.bold,
                borderTopLeftRadius: theme.primitives.radius.xl,
                borderTopRightRadius: theme.primitives.radius.xl
              },
              sheetStyle
            ]}
            testID={testID}
          >
            <GestureDetector gesture={drag}>
              <View style={styles.grab}>
                <View
                  style={[
                    styles.handle,
                    {
                      backgroundColor: c.limonada,
                      borderColor: c.ink,
                      borderWidth: theme.primitives.border.thin
                    }
                  ]}
                />
                {title || closeButton ? (
                  <View style={styles.header}>
                    {title ? (
                      <Text role="heading" style={styles.title} variant="title2">
                        {title}
                      </Text>
                    ) : (
                      <View style={styles.title} />
                    )}
                    {closeButton ? (
                      <IconButton
                        accessibilityLabel="Cerrar"
                        disabled={!dismissible}
                        icon="close"
                        onPress={onClose}
                        size="sm"
                        testID={testID ? `${testID}-close` : undefined}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            {scroll ? (
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={snap === "tall" ? styles.flex : styles.shrink}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.content, snap === "tall" ? styles.flex : null]}>{children}</View>
            )}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  shrink: {
    flexShrink: 1
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    pointerEvents: "box-none"
  },
  sheet: {
    borderBottomWidth: 0,
    overflow: "hidden"
  },
  grab: {
    paddingTop: 10,
    paddingHorizontal: 20
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 10,
    borderRadius: 5,
    marginBottom: 6
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  title: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 16
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10
  }
});
