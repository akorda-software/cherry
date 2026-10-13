import { Image } from "expo-image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";

import type { PhotoSummary } from "@cherry/contracts";

import { HardShadow, pastelForName, Text, useTheme, WashiTape } from "../../../shared/ui";

export interface PhotoCarouselProps {
  photos: readonly PhotoSummary[];
  /** Nombre de la persona (texto alternativo y placeholder sin fotos). */
  name: string;
  width: number;
  height: number;
  /**
   * `tap`: zonas de toque izquierda/derecha + segmentos de progreso arriba (swipe, perfil).
   * `swipe`: carrusel horizontal que se arrastra + puntos arriba (feed; abajo va el nombre).
   */
  mode?: "tap" | "swipe";
  /** Índice controlado (la card de swipe gestiona los toques con su propio gesto). */
  index?: number;
  onIndexChange?(index: number): void;
  /** Zonas de toque activas en modo `tap` (desactívalas si otro gesto las gestiona). */
  interactive?: boolean;
  /** Toque en una foto en modo `swipe` (p. ej. abrir el perfil completo). */
  onPress?(): void;
  radius?: number;
  /** Tiras de washi tape en las esquinas de arriba (pisan el borde, nunca la cara). */
  tape?: boolean;
  /** Precarga todas las fotos (def. sí). */
  preload?: boolean;
  /** Mueve los segmentos hacia abajo (p. ej. si algo tapa el borde superior). */
  indicatorInset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Fotos de una persona. Nunca decora encima de la cara: los segmentos y los puntos son
 * finos y van en los bordes; la cinta solo pisa las esquinas.
 */
export const PhotoCarousel = memo(function PhotoCarousel({
  photos,
  name,
  width,
  height,
  mode = "tap",
  index,
  onIndexChange,
  interactive = true,
  onPress,
  radius,
  tape = false,
  preload = true,
  indicatorInset = 0,
  style,
  testID
}: PhotoCarouselProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const [ownIndex, setOwnIndex] = useState(0);
  const count = photos.length;
  const current = Math.min(Math.max(index ?? ownIndex, 0), Math.max(count - 1, 0));
  const corner = radius ?? theme.primitives.radius.sm;
  const urls = useMemo(() => photos.map((photo) => photo.url), [photos]);

  useEffect(() => {
    if (preload && urls.length > 1 && typeof Image.prefetch === "function") {
      Image.prefetch(urls, "memory-disk").catch(() => undefined);
    }
  }, [preload, urls]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), Math.max(count - 1, 0));

      if (index === undefined) {
        setOwnIndex(clamped);
      }

      onIndexChange?.(clamped);
    },
    [count, index, onIndexChange]
  );

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (mode === "swipe" && index !== undefined) {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
    }
  }, [index, mode, width]);

  // Listas que reciclan (FlashList): otra persona en el mismo componente empieza en su primera foto.
  const identity = photos[0]?.id ?? name;
  const lastIdentity = useRef(identity);
  useEffect(() => {
    if (lastIdentity.current === identity) {
      return;
    }

    lastIdentity.current = identity;
    setOwnIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [identity]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));

      if (page !== current) {
        go(page);
      }
    },
    [current, go, width]
  );

  const frame = [styles.frame, { width, height, borderRadius: corner, backgroundColor: c.paperDeep }, style];

  if (count === 0) {
    const tone = theme.primitives.pastel[pastelForName(name)];

    return (
      <View style={[frame, styles.empty, { backgroundColor: tone.soft }]} testID={testID}>
        <Text style={{ fontSize: Math.min(width, height) * 0.32, lineHeight: Math.min(width, height) * 0.4 }} variant="hero">
          {name.trim().slice(0, 1).toUpperCase()}
        </Text>
        <Text color="muted" variant="caption">
          Aún sin fotos
        </Text>
        {tape ? <Tapes width={width} /> : null}
      </View>
    );
  }

  const label = (i: number) => `Foto ${i + 1} de ${count} de ${name}`;

  // Sin toques propios (la card de swipe los gestiona con su gesto): que no roben el puntero.
  const passive = mode === "tap" && !interactive;

  return (
    <View pointerEvents={passive ? "none" : "auto"} style={frame} testID={testID}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: corner, overflow: "hidden" }]}>
        {mode === "swipe" && count > 1 ? (
          <ScrollView
            ref={scrollRef}
            accessibilityLabel={label(current)}
            decelerationRate="fast"
            horizontal
            onMomentumScrollEnd={onMomentumEnd}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            testID={testID ? `${testID}-pager` : undefined}
          >
            {photos.map((photo, i) => (
              <Pressable
                key={photo.id}
                accessibilityLabel={label(i)}
                accessibilityRole={onPress ? "button" : "image"}
                disabled={!onPress}
                onPress={onPress}
                style={{ width, height }}
              >
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  pointerEvents="none"
                  recyclingKey={photo.id}
                  source={{ uri: photo.url }}
                  style={styles.fill}
                  transition={120}
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Image
            accessibilityLabel={label(current)}
            accessible
            cachePolicy="memory-disk"
            contentFit="cover"
            pointerEvents="none"
            recyclingKey={photos[current]?.id}
            source={{ uri: photos[current]?.url }}
            style={styles.fill}
            transition={140}
          />
        )}
      </View>

      {mode === "tap" && interactive && count > 1 ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Foto anterior"
            accessibilityRole="button"
            onPress={() => go(current - 1)}
            style={styles.zoneLeft}
            testID={testID ? `${testID}-prev` : undefined}
          />
          <Pressable
            accessibilityLabel="Foto siguiente"
            accessibilityRole="button"
            onPress={() => go(current + 1)}
            style={styles.zoneRight}
            testID={testID ? `${testID}-next` : undefined}
          />
        </View>
      ) : null}

      {mode === "swipe" && count === 1 && onPress ? (
        <Pressable accessibilityLabel={label(0)} accessibilityRole="button" onPress={onPress} style={StyleSheet.absoluteFill} />
      ) : null}

      {count > 1 && mode === "tap" ? <Segments count={count} current={current} top={10 + indicatorInset} /> : null}
      {count > 1 && mode === "swipe" ? <Dots count={count} current={current} /> : null}
      {tape ? <Tapes width={width} /> : null}
    </View>
  );
});

function Segments({ count, current, top }: { count: number; current: number; top: number }) {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <View pointerEvents="none" style={[styles.segments, { top }]}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              borderColor: c.ink,
              backgroundColor: i === current ? c.white : c.scrimStrong
            }
          ]}
        />
      ))}
    </View>
  );
}

function Dots({ count, current }: { count: number; current: number }) {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <View pointerEvents="none" style={styles.dotsWrap}>
      <HardShadow
        elevation="xs"
        style={[styles.dots, { backgroundColor: c.white, borderColor: c.ink, borderWidth: theme.primitives.border.thin }]}
      >
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === current
                ? { width: 16, backgroundColor: c.ink, borderColor: c.ink }
                : { backgroundColor: c.paperDeep, borderColor: c.inkSoft }
            ]}
          />
        ))}
      </HardShadow>
    </View>
  );
}

function Tapes({ width }: { width: number }) {
  const tapeWidth = Math.min(Math.max(width * 0.26, 58), 92);

  return (
    <>
      <WashiTape
        color="lavanda"
        height={24}
        pattern="dots"
        rotation={-36}
        style={[styles.tape, { left: -tapeWidth * 0.32 }]}
        width={tapeWidth}
      />
      <WashiTape
        color="menta"
        height={24}
        pattern="stripes"
        rotation={36}
        style={[styles.tape, { right: -tapeWidth * 0.32 }]}
        width={tapeWidth}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative"
  },
  fill: {
    width: "100%",
    height: "100%"
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  zoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "40%"
  },
  zoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "60%"
  },
  segments: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 5
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5
  },
  dotsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 10,
    alignItems: "center"
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 9
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5
  },
  tape: {
    position: "absolute",
    top: -6
  }
});
