import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle
} from "react-native-reanimated";

import { HardShadow, Icon, Stamp, Text, useTheme } from "../../../../shared/ui";

interface SwipeStampsProps {
  tx: SharedValue<number>;
  /** 1 = sello de «me gusta» forzado (botón), -1 = «paso», 0 = según el arrastre. */
  force: SharedValue<number>;
  /** Escala extra del golpe del sello (1 = en reposo). */
  kick: SharedValue<number>;
  armed: SharedValue<number>;
  threshold: number;
  photoAreaHeight: number;
}

/**
 * Sellos de goma «¡ME GUSTA!» (fresa) y «PASO» (lavanda): aparecen en proporción al
 * arrastre (previsualizar antes de decidir) y caen de golpe al cruzar el umbral.
 */
export function SwipeStamps({ tx, force, kick, armed, threshold, photoAreaHeight }: SwipeStampsProps) {
  const likeStyle = useAnimatedStyle(() => {
    const fromDrag = interpolate(tx.value, [10, threshold * 0.85], [0, 1], Extrapolation.CLAMP);
    const forced = force.value === 1 ? 1 : 0;
    const fall = interpolate(tx.value, [0, threshold], [1.35, 1], Extrapolation.CLAMP);
    const scale = forced === 1 ? kick.value : fall * (armed.value === 1 ? kick.value : 1);

    return {
      opacity: Math.max(fromDrag, forced),
      transform: [{ rotate: "-14deg" }, { scale }]
    };
  });

  const passStyle = useAnimatedStyle(() => {
    const fromDrag = interpolate(-tx.value, [10, threshold * 0.85], [0, 1], Extrapolation.CLAMP);
    const forced = force.value === -1 ? 1 : 0;
    const fall = interpolate(-tx.value, [0, threshold], [1.35, 1], Extrapolation.CLAMP);
    const scale = forced === 1 ? kick.value : fall * (armed.value === -1 ? kick.value : 1);

    return {
      opacity: Math.max(fromDrag, forced),
      transform: [{ rotate: "14deg" }, { scale }]
    };
  });

  const top = Math.max(28, photoAreaHeight * 0.1);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.stamp, { top, left: 22 }, likeStyle]}>
        <RubberStamp kind="like" />
      </Animated.View>
      <Animated.View style={[styles.stamp, { top, right: 22 }, passStyle]}>
        <RubberStamp kind="pass" />
      </Animated.View>
    </View>
  );
}

function RubberStamp({ kind }: { kind: "like" | "pass" }) {
  return (
    <Stamp
      label={kind === "like" ? "¡Me gusta!" : "Paso"}
      rotation={0}
      size="lg"
      tone={kind === "like" ? "fresa" : "lavanda"}
    />
  );
}

interface SwipeOpenHintProps {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  photoAreaHeight: number;
}

/** Pista del gesto hacia arriba: «Suelta para ver su perfil», proporcional al arrastre. */
export function SwipeOpenHint({ tx, ty, photoAreaHeight }: SwipeOpenHintProps) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const upward = interpolate(-ty.value, [24, 110], [0, 1], Extrapolation.CLAMP);
    const straight = interpolate(Math.abs(tx.value), [30, 90], [1, 0], Extrapolation.CLAMP);
    const opacity = upward * straight;

    return {
      opacity,
      transform: [{ translateY: interpolate(opacity, [0, 1], [10, 0]) }, { scale: interpolate(opacity, [0, 1], [0.94, 1]) }]
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.hintWrap, { top: photoAreaHeight - 64 }, style]}
    >
      <HardShadow
        elevation="sm"
        style={[
          styles.hint,
          {
            backgroundColor: theme.primitives.color.white,
            borderColor: theme.primitives.color.ink,
            borderWidth: theme.primitives.border.thin,
            borderRadius: theme.primitives.radius.pill
          }
        ]}
      >
        <Icon name="arrow-up" size={18} />
        <Text maxFontSizeMultiplier={1.2} variant="label">
          Suelta para ver su perfil
        </Text>
      </HardShadow>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: "absolute"
  },
  hintWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center"
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8
  }
});
