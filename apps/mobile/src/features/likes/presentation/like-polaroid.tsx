import { Image } from "expo-image";
import { memo, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  SlideOutLeft,
  ZoomIn,
  ZoomOut,
  useReducedMotion
} from "react-native-reanimated";

import type { ReceivedLike } from "@snack/contracts";

import {
  IconButton,
  Pill,
  PressableScale,
  Stamp,
  Text,
  WashiTape,
  easings,
  useTheme,
  type PastelName
} from "../../../shared/ui";

export interface LikePolaroidProps {
  like: ReceivedLike;
  index: number;
  width: number;
  /** Hay una respuesta en vuelo para esta persona. */
  busy: boolean;
  /** Retardo de la entrada (solo el primer lote hace cascada). */
  enterDelay: number | null;
  /** Retardo del sello «¡Te dio like!» (cae de golpe al aparecer). */
  stampDelay: number;
  onOpen(profileId: string): void;
  onLike(profileId: string): void;
  onPass(profileId: string): void;
}

const TAPES: readonly PastelName[] = ["lavanda", "menta", "limonada", "cielo", "melocoton"];
const BUTTON_OVERLAP = 24;
const STAMP_SCALE = 0.62;

/**
 * Polaroid pequeña de alguien que te dio like: foto, nombre y edad, etiquetas en común y un
 * sello «¡Te dio like!». Los botones ✕ / ♥ se pegan al borde inferior como pegatinas.
 */
export const LikePolaroid = memo(function LikePolaroid({
  like,
  index,
  width,
  busy,
  enterDelay,
  stampDelay,
  onOpen,
  onLike,
  onPass
}: LikePolaroidProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const c = theme.primitives.color;
  const profile = like.profile;
  const [leaving, setLeaving] = useState<"like" | "pass" | null>(null);
  const [stampOn, setStampOn] = useState(stampDelay <= 0);

  useEffect(() => {
    if (stampOn) {
      return undefined;
    }
    const timer = setTimeout(() => setStampOn(true), stampDelay);
    return () => clearTimeout(timer);
  }, [stampDelay, stampOn]);

  const name = profile.displayName;
  const title = profile.age ? `${name}, ${profile.age}` : name;
  const shared = profile.sharedTagsCount;
  const tilt = index % 2 === 0 ? -1.2 : 1.1;
  const photo = profile.photoUrl ?? profile.photos[0]?.url ?? null;
  const disabled = busy || leaving !== null;

  function answer(kind: "like" | "pass") {
    if (disabled) {
      return;
    }
    // Primero fijamos la animación de salida y, al siguiente frame, respondemos (la tarjeta se va).
    setLeaving(kind);
    requestAnimationFrame(() => (kind === "like" ? onLike(profile.id) : onPass(profile.id)));
  }

  const entering = reduced
    ? undefined
    : enterDelay === null
      ? ZoomIn.duration(260)
      : FadeInDown.delay(enterDelay).duration(340).easing(easings.out);

  const exiting = reduced
    ? FadeOut.duration(160)
    : leaving === "like"
      ? ZoomOut.duration(220)
      : leaving === "pass"
        ? SlideOutLeft.duration(260)
        : FadeOut.duration(180);

  const summary = [
    title,
    "te dio like",
    shared > 0 ? `${shared} ${shared === 1 ? "etiqueta" : "etiquetas"} en común` : null
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      layout={reduced ? undefined : LinearTransition.duration(280).easing(easings.inOut)}
      style={[styles.root, { width, paddingBottom: BUTTON_OVERLAP }]}
      testID={`like-card-${profile.id}`}
    >
      <PressableScale
        accessibilityHint="Abre su perfil completo"
        accessibilityLabel={summary}
        elevation="md"
        faceStyle={[
          styles.frame,
          {
            backgroundColor: c.white,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.regular,
            borderRadius: theme.primitives.radius.xs
          }
        ]}
        onPress={() => onOpen(profile.id)}
        rotate={tilt}
        testID={`like-open-${profile.id}`}
      >
        <View
          style={[
            styles.photo,
            {
              backgroundColor: c.paperDeep,
              borderColor: c.ink,
              borderWidth: theme.primitives.border.hairline
            }
          ]}
        >
          {photo ? (
            <Image
              accessibilityIgnoresInvertColors
              contentFit="cover"
              recyclingKey={profile.id}
              source={{ uri: photo }}
              style={StyleSheet.absoluteFill}
              transition={180}
            />
          ) : (
            <View style={[styles.initial, { backgroundColor: theme.primitives.pastel.fresa.soft }]}>
              <Text
                maxFontSizeMultiplier={1}
                style={{ fontFamily: theme.primitives.fonts.display, fontSize: 44, lineHeight: 52 }}
              >
                {name.trim().charAt(0).toUpperCase() || "·"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.caption}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} variant="title3">
            {title}
          </Text>
          {shared > 0 ? (
            <Pill color="menta" icon="tag" label={`${shared} en común`} size="sm" />
          ) : (
            <View style={styles.pillSpacer} />
          )}
        </View>

        <View style={styles.tape}>
          <WashiTape
            color={TAPES[index % TAPES.length]}
            height={18}
            pattern={index % 3 === 0 ? "dots" : index % 3 === 1 ? "stripes" : "hearts"}
            rotation={index % 2 === 0 ? 34 : 40}
            width={Math.round(width * 0.36)}
          />
        </View>

        {stampOn ? (
          <View style={styles.stampAnchor}>
            <Stamp label="¡Te dio like!" rotation={-9} size="sm" slam tone="fresa" />
          </View>
        ) : null}
      </PressableScale>

      <View style={styles.actions}>
        <IconButton
          accessibilityLabel={`Pasar de ${name}`}
          color="lavanda"
          disabled={disabled}
          haptic="light"
          icon="x"
          onPress={() => answer("pass")}
          testID={`like-pass-${profile.id}`}
        />
        <IconButton
          accessibilityLabel={`Dar like a ${name}`}
          color="fresa"
          disabled={disabled}
          haptic="medium"
          icon="heart"
          iconFill={c.white}
          onPress={() => answer("like")}
          testID={`like-like-${profile.id}`}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: "relative"
  },
  frame: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: BUTTON_OVERLAP + 12
  },
  photo: {
    aspectRatio: 4 / 5,
    borderRadius: 3,
    overflow: "hidden"
  },
  initial: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  caption: {
    gap: 6,
    paddingTop: 8,
    paddingHorizontal: 2
  },
  pillSpacer: {
    height: 24
  },
  tape: {
    position: "absolute",
    top: 4,
    right: -16,
    pointerEvents: "none"
  },
  stampAnchor: {
    position: "absolute",
    top: 2,
    left: -6,
    transform: [{ scale: STAMP_SCALE }],
    transformOrigin: "left top",
    pointerEvents: "none"
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 14
  }
});
