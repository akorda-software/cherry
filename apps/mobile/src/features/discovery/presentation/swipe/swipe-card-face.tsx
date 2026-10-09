import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { DiscoveryProfileCard } from "@snack/contracts";

import { Appear, HardShadow, IconButton, PopIn, Text, useTheme, WashiTape } from "../../../../shared/ui";
import {
  MetaLine,
  NameSticker,
  PhotoCarousel,
  ProfileBadges,
  TagStickerRow,
  toProfilePerson
} from "../../../profile-card";

/** Borde blanco de la polaroid alrededor de la foto. */
export const POLAROID_MARGIN = 10;
/** Franja de datos bajo la foto: pegatina del nombre que asoma, etiquetas y la línea de datos (dos renglones). */
const INFO_HEIGHT = 118;
/** Pie con los botones ✕ ↺ · Ver perfil · ♥, dentro de la carta (como en el feed). */
export const SWIPE_FOOTER_HEIGHT = 72;
const PASS_SIZE = 48;
const UNDO_SIZE = 40;
const LIKE_SIZE = 64;
const FOOTER_INSET = 4;
const FOOTER_GAP = 10;

/** Alto de la foto dentro de una card de `height` puntos: lo que dejan la franja de datos y el pie. */
export function swipePhotoHeight(height: number): number {
  return Math.round(Math.max(height - 2 * POLAROID_MARGIN - INFO_HEIGHT - SWIPE_FOOTER_HEIGHT, height * 0.46));
}

export type SwipeFooterTarget = "dislike" | "undo" | "open" | "like";

/**
 * Qué botón del pie hay en (x, y), en coordenadas de la card. Los botones del pie solo
 * pintan: el toque lo resuelve el gesto de la card (así nunca compiten arrastre y botón).
 * Zonas algo más anchas que los botones para acertar con el pulgar.
 */
export function swipeFooterHit(x: number, y: number, width: number, height: number): SwipeFooterTarget | null {
  const footerTop = height - POLAROID_MARGIN - SWIPE_FOOTER_HEIGHT;
  if (y < footerTop - 6) return null;
  const passEnd = POLAROID_MARGIN + FOOTER_INSET + PASS_SIZE;
  const undoEnd = passEnd + FOOTER_GAP + UNDO_SIZE;
  const likeStart = width - POLAROID_MARGIN - FOOTER_INSET - LIKE_SIZE;
  if (x < passEnd + FOOTER_GAP / 2) return "dislike";
  if (x < undoEnd + FOOTER_GAP) return "undo";
  if (x > likeStart - FOOTER_GAP) return "like";
  return "open";
}

interface SwipeCardFaceProps {
  card: DiscoveryProfileCard;
  width: number;
  height: number;
  photoIndex: number;
  isTop: boolean;
  flying: boolean;
  /** Hay un «no» que recuperar (el ↺ del pie se ve activo). */
  canUndo: boolean;
}

/**
 * Card polaroid: foto con dos tiras de washi en las esquinas, nombre en pegatina que se
 * sale por el borde inferior de la foto, etiquetas en común, los datos que ayudan a
 * decidir y, abajo, el pie con ✕ ↺ · Ver perfil · ♥ (como en el feed).
 */
export const SwipeCardFace = memo(function SwipeCardFace({ card, width, height, photoIndex, isTop, flying, canUndo }: SwipeCardFaceProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const person = useMemo(() => toProfilePerson(card), [card]);
  const photoWidth = width - POLAROID_MARGIN * 2;
  const photoHeight = swipePhotoHeight(height);
  const hasShared = person.tags.some((tag) => tag.shared);
  const tapeWidth = Math.min(Math.max(width * 0.24, 64), 96);

  return (
    <HardShadow
      elevation="lg"
      style={[
        styles.card,
        {
          width,
          height,
          padding: POLAROID_MARGIN,
          backgroundColor: c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.bold,
          borderRadius: theme.primitives.radius.md
        }
      ]}
    >
      <PhotoCarousel
        height={photoHeight}
        index={photoIndex}
        interactive={false}
        name={person.displayName}
        photos={person.photos}
        preload={isTop}
        radius={theme.primitives.radius.sm}
        width={photoWidth}
      />

      <View style={[styles.nameRow, { top: POLAROID_MARGIN + photoHeight - 28 }]}>
        <NameSticker age={person.age} name={person.displayName} size="md" />
      </View>

      {/* Las de detrás son solo carcasa + foto: su franja de datos (y el botón ↑) asomaría
          por debajo de la de arriba. Al llegar arriba, los datos aparecen con un fundido. */}
      {isTop || flying ? (
        <Appear from="none" style={styles.info}>
          {hasShared ? (
            <TagStickerRow limit={2} sharedOnly size="sm" tags={person.tags} testID={isTop ? "swipe-shared-tags" : undefined} />
          ) : (
            <ProfileBadges includeShared limit={3} person={person} singleLine size="sm" />
          )}
          <MetaLine distanceLabel={person.distanceLabel} intents={person.lookingFor} />
        </Appear>
      ) : null}

      {isTop || flying ? (
        // Solo pintan: el toque lo resuelve el gesto de la card con `swipeFooterHit`
        // (los lectores de pantalla usan las acciones de la card).
        <View pointerEvents="none" style={styles.footer} testID={isTop ? "swipe-footer" : undefined}>
          <View style={styles.footerSide}>
            <IconButton accessibilityLabel="Paso" color="lavanda" icon="x" onPress={noop} size="md" />
            <IconButton accessibilityLabel="Deshacer el último no" color="limonada" disabled={!canUndo} icon="undo" onPress={noop} size="sm" />
          </View>
          <View style={styles.open} testID={isTop ? "swipe-open-profile" : undefined}>
            <Text color="muted" numberOfLines={1} variant="label">
              Ver perfil
            </Text>
          </View>
          <IconButton accessibilityLabel="Me gusta" color="fresa" icon="heart" iconFill={c.white} onPress={noop} size="lg" />
        </View>
      ) : null}

      {isTop || flying ? (
        // La cinta se «pega» cuando la foto llega arriba de la pila (las de detrás no la enseñan).
        <>
          <PopIn fromScale={0.85} style={[styles.tape, { left: -tapeWidth * 0.3 }]}>
            <WashiTape color="lavanda" height={26} pattern="dots" rotation={-34} width={tapeWidth} />
          </PopIn>
          <PopIn delay={60} fromScale={0.85} style={[styles.tape, { right: -tapeWidth * 0.3 }]}>
            <WashiTape color="menta" height={26} pattern="stripes" rotation={34} width={tapeWidth} />
          </PopIn>
        </>
      ) : null}
    </HardShadow>
  );
});

function noop() {}

const styles = StyleSheet.create({
  card: {
    overflow: "visible"
  },
  nameRow: {
    position: "absolute",
    left: POLAROID_MARGIN + 8,
    right: 56
  },
  info: {
    height: INFO_HEIGHT,
    paddingTop: 34,
    paddingHorizontal: 4,
    gap: 8,
    overflow: "hidden"
  },
  footer: {
    height: SWIPE_FOOTER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: FOOTER_INSET
  },
  footerSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: FOOTER_GAP
  },
  open: {
    flex: 1,
    alignItems: "center"
  },
  tape: {
    position: "absolute",
    top: -8
  }
});
