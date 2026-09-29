import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { Profile } from "@snack/contracts";

import {
  type AppTheme,
  Inline,
  type PastelName,
  Pill,
  Stamp,
  Surface,
  TagSticker,
  useTheme
} from "../../../shared/ui";
import { IntentBadge, NameSticker, PhotoCarousel, sortTagsForDisplay } from "../../profile-card";
import { toSelfPerson } from "../domain/self-person";

const FRAME_PADDING = 10;

/** Mismo tinte por categoría que las etiquetas de los demás (`theme.semantic.category`). */
function categoryTint(theme: AppTheme, category: string): PastelName | undefined {
  const swatch = (theme.semantic.category as Record<string, unknown>)[category];
  return (Object.keys(theme.primitives.pastel) as PastelName[]).find((name) => theme.primitives.pastel[name] === swatch);
}

/** Las tarjetas de los demás enseñan pocas etiquetas de un vistazo; aquí igual. */
const VISIBLE_TAGS = 4;

interface SelfPreviewCardProps {
  profile: Profile;
  paused: boolean;
  /** Ancho total de la polaroid. */
  width: number;
  testID?: string;
}

/**
 * «Así te ven»: tu tarjeta con los mismos átomos que pintan a los demás (fotos con washi,
 * nombre en pegatina, qué buscas y tus etiquetas). En pausa, un sello cae sobre la foto.
 */
export const SelfPreviewCard = memo(function SelfPreviewCard({ profile, paused, width, testID }: SelfPreviewCardProps) {
  const theme = useTheme();
  const person = useMemo(() => toSelfPerson(profile), [profile]);
  const tags = useMemo(() => sortTagsForDisplay(person.tags), [person.tags]);
  const photoSide = width - 2 * (FRAME_PADDING + theme.primitives.border.bold);
  const hiddenTags = tags.length - VISIBLE_TAGS;

  return (
    <View style={[styles.root, { width }]} testID={testID}>
      <Surface elevation="lg" padding={FRAME_PADDING} radius="lg">
        <View>
          <PhotoCarousel
            height={photoSide}
            name={person.displayName}
            photos={person.photos}
            radius={theme.primitives.radius.md}
            tape
            testID={testID ? `${testID}-photos` : undefined}
            width={photoSide}
          />
          {paused ? (
            <View style={styles.stampSlot}>
              <Stamp label="En pausa" rotation={-9} size="md" slam testID="me-paused-stamp" tone="lavanda" />
            </View>
          ) : null}
        </View>
        <NameSticker age={person.age} name={person.displayName} size="lg" style={styles.name} />
        <View style={styles.meta}>
          <IntentBadge intent={person.whatIAmLookingFor} />
          {tags.length > 0 ? (
            <Inline gap="sm">
              {tags.slice(0, VISIBLE_TAGS).map((tag, index) => (
                <TagSticker
                  emoji={tag.emoji}
                  key={tag.id}
                  label={tag.label}
                  rotate={index % 2 === 0 ? -1.5 : 1}
                  size="sm"
                  tint={categoryTint(theme, tag.category)}
                />
              ))}
              {hiddenTags > 0 ? (
                <Pill
                  accessibilityLabel={`y ${hiddenTags} etiqueta${hiddenTags === 1 ? "" : "s"} más`}
                  label={`+${hiddenTags}`}
                  size="sm"
                />
              ) : null}
            </Inline>
          ) : null}
        </View>
      </Surface>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    alignSelf: "center",
    transform: [{ rotate: "-1.5deg" }]
  },
  stampSlot: {
    position: "absolute",
    right: 6,
    bottom: 38,
    pointerEvents: "none"
  },
  name: {
    marginTop: -26,
    marginLeft: 10
  },
  meta: {
    marginTop: 12,
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 6
  }
});
