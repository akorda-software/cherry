import { memo, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";

import type { DiscoveryActionType, DiscoveryProfileCard } from "@snack/contracts";

import { easings, IconButton, Stamp, Text, useTheme } from "../../../../shared/ui";
import { NameSticker, PhotoCarousel, ProfileSummary, toProfilePerson } from "../../../profile-card";
import { describePerson } from "../describe-person";

export const FEED_POST_GAP = 28;
const MARGIN = 10;

interface FeedPostProps {
  card: DiscoveryProfileCard;
  width: number;
  /** Alto máximo de la foto para que el post entero quepa en pantalla. */
  maxPhotoHeight: number;
  /** Se está despidiendo (sello + colapso) tras decidir. */
  leaving: DiscoveryActionType | null | undefined;
  /** El perfil ya no está en la cola pero la despedida espera a que Descubrir esté a la vista. */
  holdFarewell: boolean;
  reducedMotion: boolean;
  onDecide(card: DiscoveryProfileCard, action: DiscoveryActionType): void;
  onOpen(card: DiscoveryProfileCard): void;
  onFarewellDone(profileId: string): void;
}

/**
 * Un «post» del feed: una persona completa (fotos arrastrables con puntos, nombre, insignias,
 * etiquetas en común, bio en nota, intención y distancia) con ✕ / ♥ al pie.
 */
export const FeedPost = memo(function FeedPost({
  card,
  width,
  maxPhotoHeight,
  leaving,
  holdFarewell,
  reducedMotion,
  onDecide,
  onOpen,
  onFarewellDone
}: FeedPostProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const person = useMemo(() => toProfilePerson(card), [card]);
  const photoWidth = width - MARGIN * 2;
  // Cada post es una unidad completa: foto, datos y botones caben a la vez en pantalla.
  const photoHeight = Math.round(Math.max(Math.min(photoWidth * 1.2, maxPhotoHeight), Math.min(photoWidth * 0.8, 260)));
  const fade = useSharedValue(1);
  const lift = useSharedValue(0);
  const isLeaving = leaving !== undefined;

  useEffect(() => {
    if (!isLeaving) {
      fade.value = withTiming(1, { duration: 160 });
      lift.value = withTiming(0, { duration: 160 });
      return;
    }

    if (holdFarewell) {
      return;
    }

    const done = (finished?: boolean) => {
      "worklet";

      if (finished) {
        runOnJS(onFarewellDone)(card.id);
      }
    };

    // El sello cae (Stamp slam) y, tras un respiro para leerlo, el post se despega y se va.
    const hold = reducedMotion ? 280 : 520;
    fade.value = withDelay(hold, withTiming(0, { duration: 220, easing: easings.out }, done));
    lift.value = withDelay(hold, withTiming(1, { duration: 220, easing: easings.out }));
  }, [card.id, fade, holdFarewell, isLeaving, lift, onFarewellDone, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: reducedMotion
      ? []
      : [
          { translateX: (leaving === "like" ? 1 : leaving === "dislike" ? -1 : 0) * lift.value * 36 },
          { rotate: `${(leaving === "like" ? 1 : leaving === "dislike" ? -1 : 0) * lift.value * 4}deg` },
          { scale: 1 - lift.value * 0.05 }
        ]
  }));

  const stampVisible = isLeaving && leaving !== null && !holdFarewell;

  return (
    <Animated.View
      pointerEvents={isLeaving ? "none" : "auto"}
      style={[styles.wrap, { width, marginBottom: FEED_POST_GAP }, animatedStyle]}
      testID={`feed-post-${card.id}`}
    >
      <View
        style={[
          styles.post,
          {
            padding: MARGIN,
            backgroundColor: c.white,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.bold,
            borderRadius: theme.primitives.radius.md
          },
          theme.primitives.elevation.md
        ]}
      >
        <PhotoCarousel
          height={photoHeight}
          mode="swipe"
          name={person.displayName}
          onPress={() => onOpen(card)}
          photos={person.photos}
          radius={theme.primitives.radius.sm}
          tape
          width={photoWidth}
          testID={`feed-photos-${card.id}`}
        />

        <View style={[styles.name, { top: MARGIN + photoHeight - 26 }]}>
          <Pressable
            accessibilityHint="Abre su perfil completo"
            accessibilityLabel={describePerson(person)}
            accessibilityRole="button"
            onPress={() => onOpen(card)}
          >
            <NameSticker age={person.age} name={person.displayName} rotate={-2.5} />
          </Pressable>
        </View>

        <ProfileSummary profile={person} style={styles.summary} variant="feed" />

        <View style={styles.footer}>
          <IconButton
            accessibilityLabel={`Paso de ${person.displayName}`}
            color="lavanda"
            disabled={isLeaving}
            icon="x"
            onPress={() => onDecide(card, "dislike")}
            size="md"
            testID={`feed-pass-${card.id}`}
          />
          <Pressable
            accessibilityLabel={`Ver el perfil completo de ${person.displayName}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onOpen(card)}
            style={styles.more}
          >
            <Text color="muted" variant="label">
              Ver perfil
            </Text>
          </Pressable>
          <IconButton
            accessibilityLabel={`Me gusta ${person.displayName}`}
            color="fresa"
            disabled={isLeaving}
            haptic="medium"
            icon="heart"
            iconFill={c.white}
            onPress={() => onDecide(card, "like")}
            size="lg"
            testID={`feed-like-${card.id}`}
          />
        </View>

        {stampVisible ? (
          <View pointerEvents="none" style={[styles.stampWrap, { top: MARGIN + photoHeight * 0.3 }]}>
            <Stamp
              label={leaving === "like" ? "¡Me gusta!" : "Paso"}
              rotation={leaving === "like" ? -12 : 10}
              size="lg"
              slam
              tone={leaving === "like" ? "fresa" : "lavanda"}
            />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center"
  },
  post: {
    overflow: "visible"
  },
  name: {
    position: "absolute",
    left: MARGIN + 8,
    right: MARGIN + 8
  },
  summary: {
    paddingTop: 36,
    paddingHorizontal: 4
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingHorizontal: 4,
    paddingBottom: 4
  },
  more: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  stampWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center"
  }
});
