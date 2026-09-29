import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { DiscoveryProfileCard } from "@snack/contracts";

import { Appear, Icon, PopIn, useTheme, WashiTape } from "../../../../shared/ui";
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

/** Alto de la foto dentro de una card de `height` puntos (~70 % del alto). */
export function swipePhotoHeight(height: number): number {
  return Math.round(Math.max(height - 170, height * 0.64));
}

interface SwipeCardFaceProps {
  card: DiscoveryProfileCard;
  width: number;
  height: number;
  photoIndex: number;
  isTop: boolean;
  flying: boolean;
}

/**
 * Card polaroid: foto ~70 % del alto con dos tiras de washi en las esquinas, nombre en
 * pegatina que se sale por el borde inferior de la foto, etiquetas en común como
 * pegatinas amarillas con destello y los datos que ayudan a decidir.
 */
export const SwipeCardFace = memo(function SwipeCardFace({ card, width, height, photoIndex, isTop, flying }: SwipeCardFaceProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const person = useMemo(() => toProfilePerson(card), [card]);
  const photoWidth = width - POLAROID_MARGIN * 2;
  const photoHeight = swipePhotoHeight(height);
  const hasShared = person.tags.some((tag) => tag.shared);
  const tapeWidth = Math.min(Math.max(width * 0.24, 64), 96);

  return (
    <View
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
        },
        theme.primitives.elevation.lg
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
          <ProfileBadges includeShared={!hasShared} limit={3} person={person} singleLine size="sm" />
          {hasShared ? (
            <TagStickerRow limit={3} sharedOnly size="sm" tags={person.tags} testID={isTop ? "swipe-shared-tags" : undefined} />
          ) : null}
          <View style={styles.bottomRow}>
            <View style={styles.meta}>
              <MetaLine distanceLabel={person.distanceLabel} intent={person.whatIAmLookingFor} />
            </View>
            {/* Solo aspecto de botón: el toque en la franja lo gestiona el gesto de la card
                (así nunca se abre dos veces) y los lectores usan la acción «Ver perfil completo». */}
            <View
              pointerEvents="none"
              style={[
                styles.openButton,
                {
                  backgroundColor: c.white,
                  borderColor: c.ink,
                  borderWidth: theme.primitives.border.regular
                },
                theme.primitives.elevation.sm
              ]}
              testID={isTop ? "swipe-open-profile" : undefined}
            >
              <Icon name="arrow-up" size={20} />
            </View>
          </View>
        </Appear>
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
    </View>
  );
});

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
    flex: 1,
    paddingTop: 34,
    paddingHorizontal: 4,
    gap: 8,
    justifyContent: "flex-start"
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: "auto"
  },
  meta: {
    flex: 1,
    minWidth: 0
  },
  tape: {
    position: "absolute",
    top: -8
  },
  openButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  }
});
