import { forwardRef, type ReactNode, useEffect, useRef } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { type HapticKind, triggerHaptic } from "../motion/haptics";
import { type SpringName, springs } from "../motion/springs";
import { type ElevationLevel, elevationOffsets } from "../tokens/primitives/elevation";
import { HardShadowLayer, splitShadowStyle } from "./hard-shadow";

export interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  children?: ReactNode;
  /** Caja exterior (márgenes, flex, ancho). */
  style?: StyleProp<ViewStyle>;
  /** Cara visible: relleno, contorno, radio, padding. */
  faceStyle?: StyleProp<ViewStyle>;
  /** Sombra dura bajo la cara (por defecto `md`). `none` = sin sombra. */
  elevation?: ElevationLevel;
  /** Radio de la sombra; por defecto el `borderRadius` de `faceStyle`. */
  radius?: number;
  /** Escala al pulsar (1 = solo se hunde; los botones redondos usan ~0.94). */
  pressedScale?: number;
  /** Muelle al soltar (`snappy` por defecto; `pop` rebota un poco). */
  releaseSpring?: SpringName;
  /** Háptico al pulsar (`true` = ligero). */
  haptic?: HapticKind | boolean;
  /** Giro en grados (pegatinas, notas). */
  rotate?: number;
  shadowColor?: string;
  /** Deshabilitado = pegado al papel, sin sombra (por defecto sí). */
  sinkWhenDisabled?: boolean;
}

/** Tiempo mínimo que se ve hundido en un toque rápido. */
const MIN_PRESS_MS = 80;

/**
 * Pulsable neobrutal: una cara con contorno sobre una sombra dura de tinta.
 * Al pulsar, la cara se hunde hacia su sombra (spring.snappy) y la tapa;
 * al soltar vuelve a su sitio. Base de botones, pegatinas y tarjetas pulsables.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  {
    children,
    style,
    faceStyle,
    elevation = "md",
    radius,
    pressedScale = 1,
    releaseSpring = "snappy",
    haptic,
    rotate,
    shadowColor,
    sinkWhenDisabled = true,
    disabled,
    onPressIn,
    onPressOut,
    accessibilityRole = "button",
    ...rest
  },
  ref
) {
  const offset = elevationOffsets[elevation];
  const rest0 = disabled && sinkWhenDisabled ? 1 : 0;
  const press = useSharedValue(rest0);
  const pressedAt = useRef(0);

  useEffect(() => {
    press.value = withSpring(rest0, springs.pop);
  }, [press, rest0]);

  const faceAnimated = useAnimatedStyle(() => {
    const p = press.value;

    return {
      transform: [{ translateX: p * offset }, { translateY: p * offset }, { scale: 1 - (1 - pressedScale) * p }]
    };
  });

  const flatFace = StyleSheet.flatten(faceStyle) ?? {};
  const shadowRadius = radius ?? (typeof flatFace.borderRadius === "number" ? flatFace.borderRadius : 0);

  function handlePressIn(event: GestureResponderEvent) {
    pressedAt.current = Date.now();
    press.value = withSpring(1, springs.snappy);
    triggerHaptic(haptic);
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    const held = Date.now() - pressedAt.current;
    const release = withSpring(0, springs[releaseSpring]);
    press.value = held < MIN_PRESS_MS ? withSequence(withTiming(1, { duration: MIN_PRESS_MS - held }), release) : release;
    onPressOut?.(event);
  }

  // La cara solo rellena la caja cuando esta tiene tamaño propio (alto, flex…). Un `flexGrow`
  // por defecto, en Android (Fabric) y dentro de pantallas con scroll, estiraba botones y
  // pegatinas hasta miles de px y los montaba sobre lo de abajo.
  const faceFills = splitShadowStyle(style).sized;

  return (
    <Pressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}
      {...rest}
    >
      <HardShadowLayer color={shadowColor} elevation={elevation} radius={shadowRadius} />
      <Animated.View style={[faceFills ? styles.fill : null, faceStyle, faceAnimated]}>{children}</Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  fill: {
    flexGrow: 1
  }
});
