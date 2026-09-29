import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DiscoveryMatch } from "@snack/contracts";
import { createProfileApi } from "@snack/mobile-shared";

import {
  Appear,
  Button,
  chatHref,
  HeartBurst,
  haptics,
  Mascot,
  PaperBackground,
  pastelForName,
  springs,
  Stamp,
  Text,
  useTheme,
  WashiTape
} from "../../../shared/ui";
import { useAuthedApi, useSessionShell } from "../../auth/presentation";
import { useOwnPhotoStore } from "../application/own-photo-store";
import { useMatchCelebrationStore } from "../match-celebration-store";

/** Momento en que las dos fotos ya se han juntado y cae el sello. */
const STAMP_AT = 520;

/**
 * Celebración de match a pantalla completa (montada una vez en `AppOverlays`). Escucha
 * `useMatchCelebrationStore`: cualquier pantalla llama `show(match)`.
 */
export function MatchCelebrationHost() {
  const match = useMatchCelebrationStore((state) => state.match);
  const dismiss = useMatchCelebrationStore((state) => state.dismiss);
  const callProfile = useAuthedApi(createProfileApi);
  const { state } = useSessionShell();
  const ownerId = state.status === "signed-in" ? state.session.user.id : null;
  const refresh = useOwnPhotoStore((store) => store.refresh);

  // Tu foto se precarga al entrar en la zona privada y se refresca en cada match.
  useEffect(() => {
    void refresh(ownerId, async () => (ownerId ? (await callProfile((api) => api.getProfile())).profile : null));
  }, [callProfile, ownerId, refresh, match?.id]);

  if (!match) {
    return null;
  }

  return <MatchCelebration key={match.id} match={match} onDismiss={dismiss} />;
}

function MatchCelebration({ match, onDismiss }: { match: DiscoveryMatch; onDismiss(): void }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const ownPhoto = useOwnPhotoStore((store) => store.url);
  const ownName = useOwnPhotoStore((store) => store.displayName);
  const [stamped, setStamped] = useState(reduced);
  const [burst, setBurst] = useState(0);
  const name = match.otherProfile.displayName ?? "alguien";
  const cardWidth = Math.min(Math.round(width * 0.38), 176);

  const veil = useSharedValue(0);
  const left = useSharedValue(reduced ? 0 : -1);
  const right = useSharedValue(reduced ? 0 : 1);
  const content = useSharedValue(reduced ? 0 : 1);

  useEffect(() => {
    veil.value = withTiming(1, { duration: reduced ? 160 : 240 });

    if (reduced) {
      content.value = withTiming(1, { duration: 200 });
      haptics.success();
      return;
    }

    left.value = withDelay(80, withSpring(0, springs.soft));
    right.value = withDelay(160, withSpring(0, springs.soft));

    const timer = setTimeout(() => {
      setStamped(true);
      setBurst((value) => value + 1);
      haptics.success();
    }, STAMP_AT);

    return () => clearTimeout(timer);
  }, [content, left, reduced, right, veil]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: reduced ? content.value : 1 }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(left.value), 1) * 0.2,
    transform: [{ translateX: left.value * width * 0.7 }, { rotate: `${-8 + left.value * 18}deg` }]
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(right.value), 1) * 0.2,
    transform: [{ translateX: right.value * width * 0.7 }, { rotate: `${7 + right.value * 18}deg` }]
  }));

  const sayHello = useCallback(() => {
    onDismiss();
    router.push(chatHref(match.conversationId));
  }, [match.conversationId, onDismiss, router]);

  const burstOrigin = useRef({ x: width / 2, y: 0 });

  return (
    <Modal
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible
    >
      <Animated.View style={[StyleSheet.absoluteFill, veilStyle]}>
        <PaperBackground tone="fresa" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }, fadeStyle]}
        testID="match-celebration"
      >
        <Mascot mood="love" size={92} style={styles.mochi} />

        <View
          onLayout={(event) => {
            const { x, y, width: w, height: h } = event.nativeEvent.layout;
            burstOrigin.current = { x: x + w / 2, y: y + h / 2 };
          }}
          style={[styles.photos, { height: cardWidth * 1.3 + 40 }]}
        >
          <Animated.View style={[styles.polaroidLeft, leftStyle]}>
            <Polaroid name={ownName ?? "Tú"} uri={ownPhoto} width={cardWidth} />
          </Animated.View>
          <Animated.View style={[styles.polaroidRight, rightStyle]}>
            <Polaroid name={name} uri={match.otherProfile.photoUrl} width={cardWidth} />
          </Animated.View>

          {stamped ? (
            <>
              <Appear from="scale" style={styles.tape}>
                <WashiTape color="limonada" height={28} pattern="hearts" rotation={-6} width={Math.round(cardWidth * 0.62)} />
              </Appear>
              <View pointerEvents="none" style={styles.stamp}>
                <Stamp label="¡Match!" rotation={-10} shape="rounded" size="lg" slam={!reduced} tone="fresa" />
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.texts}>
          <Text accessibilityRole="header" align="center" variant="hero">
            ¡Es un match!
          </Text>
          <Text align="center" variant="bodyStrong">
            {`A ${name} también le gustas.`}
          </Text>
        </View>

        <View style={styles.ctas}>
          <Button fullWidth haptic icon="chat" onPress={sayHello} size="lg" testID="match-say-hello">
            Decir hola
          </Button>
          <Button fullWidth onPress={onDismiss} size="lg" testID="match-keep-looking" variant="secondary">
            Seguir mirando
          </Button>
        </View>
      </Animated.View>

      <HeartBurst
        count={22}
        origin={burstOrigin.current}
        power={1.1}
        style={StyleSheet.absoluteFill}
        trigger={burst === 0 ? undefined : burst}
      />
    </Modal>
  );
}

function Polaroid({ uri, name, width }: { uri: string | null; name: string; width: number }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const photo = width - 16;
  const tone = theme.primitives.pastel[pastelForName(name)];

  return (
    <View
      style={[
        styles.polaroid,
        {
          width,
          backgroundColor: c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.bold,
          borderRadius: theme.primitives.radius.xs
        },
        theme.primitives.elevation.lg
      ]}
    >
      <View
        style={{
          width: photo,
          height: photo * 1.15,
          borderRadius: 4,
          overflow: "hidden",
          borderColor: c.ink,
          borderWidth: theme.primitives.border.hairline,
          backgroundColor: tone.soft,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {uri ? (
          <Image accessibilityLabel={`Foto de ${name}`} contentFit="cover" source={{ uri }} style={styles.fill} />
        ) : (
          <Text variant="hero">{name.trim().slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <Text align="center" maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.caption} variant="hand">
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 18
  },
  mochi: {
    marginBottom: -18,
    zIndex: 2
  },
  photos: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  polaroidLeft: {
    position: "absolute",
    right: "48%"
  },
  polaroidRight: {
    position: "absolute",
    left: "48%",
    top: 18
  },
  polaroid: {
    padding: 8,
    paddingBottom: 6,
    gap: 4
  },
  fill: {
    width: "100%",
    height: "100%"
  },
  caption: {
    fontSize: 18,
    lineHeight: 24
  },
  tape: {
    position: "absolute",
    top: 6
  },
  stamp: {
    position: "absolute",
    bottom: 12,
    alignItems: "center"
  },
  texts: {
    gap: 6,
    alignItems: "center"
  },
  ctas: {
    width: "100%",
    maxWidth: 380,
    gap: 12
  }
});
