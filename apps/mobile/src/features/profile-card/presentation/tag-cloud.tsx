import { memo, useCallback, useMemo, useState } from "react";
import { type LayoutChangeEvent, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import type { ProfileTag } from "@snack/contracts";

import {
  Inline,
  type PastelName,
  PopIn,
  Sparkle,
  Stack,
  stagger,
  TagSticker,
  type TagStickerSize,
  Text,
  useTheme
} from "../../../shared/ui";
import { groupOtherTagsByCategory, sharedTags, sortTagsForDisplay } from "../domain/person";

/** Pastel de la categoría (según `theme.semantic.category`); categorías futuras, sin tinte. */
function useCategoryTint() {
  const theme = useTheme();

  return useMemo(() => {
    const byCategory = new Map<string, PastelName>();
    const entries = Object.entries(theme.primitives.pastel) as Array<[PastelName, unknown]>;

    for (const [category, swatch] of Object.entries(theme.semantic.category)) {
      const match = entries.find(([, candidate]) => candidate === swatch);

      if (match) {
        byCategory.set(category, match[0]);
      }
    }

    return (category: string) => byCategory.get(category);
  }, [theme]);
}

export interface TagStickerRowProps {
  tags: readonly ProfileTag[];
  /** Cuántas pegatinas como mucho (el resto se resume en «+N»). */
  limit?: number;
  /** Solo las etiquetas en común (tarjeta de swipe). */
  sharedOnly?: boolean;
  size?: TagStickerSize;
  /** Material troquelado (def. sí, como todas las pegatinas de etiqueta). */
  diecut?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ROW_GAP = 6;
const MORE_WIDTH = 40;

/**
 * Una sola fila de pegatinas (compartidas primero, con destello) y un «+N». Mide cada
 * pegatina a su ancho natural y pinta solo las que caben enteras: nunca se recortan.
 */
export const TagStickerRow = memo(function TagStickerRow({
  tags,
  limit = 3,
  sharedOnly = false,
  size = "sm",
  diecut = true,
  style,
  testID
}: TagStickerRowProps) {
  const theme = useTheme();
  const tintFor = useCategoryTint();
  const list = useMemo(() => {
    const sorted = sortTagsForDisplay([...tags]);
    return sharedOnly ? sorted.filter((tag) => tag.shared) : sorted;
  }, [sharedOnly, tags]);
  const candidates = useMemo(() => list.slice(0, limit), [limit, list]);
  const [rowWidth, setRowWidth] = useState(0);
  const [widths, setWidths] = useState<Record<string, number>>({});

  const onRowLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setRowWidth((current) => (Math.abs(current - next) < 1 ? current : next));
  }, []);

  const measure = useCallback((id: string, width: number) => {
    setWidths((current) => (Math.abs((current[id] ?? -1) - width) < 1 ? current : { ...current, [id]: width }));
  }, []);

  const fit = useMemo(() => {
    if (rowWidth === 0 || candidates.some((tag) => widths[tag.id] === undefined)) {
      return null;
    }

    let used = 0;
    let count = 0;

    for (const [index, tag] of candidates.entries()) {
      const rest = list.length - (index + 1);
      const reserve = rest > 0 ? MORE_WIDTH + ROW_GAP : 0;
      const next = used + (count > 0 ? ROW_GAP : 0) + (widths[tag.id] ?? 0);

      if (next + reserve > rowWidth) {
        break;
      }

      used = next;
      count += 1;
    }

    return count;
  }, [candidates, list.length, rowWidth, widths]);

  if (list.length === 0) {
    return null;
  }

  const shown = fit === null ? [] : candidates.slice(0, Math.max(fit, 1));
  const rest = list.length - shown.length;

  const sticker = (tag: ProfileTag, index: number) => (
    <TagSticker
      diecut={diecut}
      emoji={tag.emoji}
      label={tag.label}
      rotate={index % 2 === 0 ? -2 : 1.5}
      size={size}
      state={tag.shared ? "shared" : "neutral"}
      tint={tag.shared ? undefined : tintFor(tag.category)}
    />
  );

  return (
    <View onLayout={onRowLayout} style={[styles.row, style]} testID={testID}>
      {/* Medición a ancho natural (invisible y fuera de la accesibilidad). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.measureClip}
      >
        <View style={styles.measureRow}>
          {candidates.map((tag, index) => (
            <View key={tag.id} onLayout={(event) => measure(tag.id, event.nativeEvent.layout.width)} style={styles.measureCell}>
              {sticker(tag, index)}
            </View>
          ))}
        </View>
      </View>
      {shown.map((tag, index) => (
        <View key={tag.id} style={styles.cell}>
          {sticker(tag, index)}
        </View>
      ))}
      {fit !== null && rest > 0 ? (
        <View
          accessibilityLabel={`y ${rest} etiqueta${rest === 1 ? "" : "s"} más`}
          accessible
          style={[
            styles.more,
            {
              borderColor: theme.primitives.color.ink,
              borderWidth: theme.primitives.border.thin,
              backgroundColor: theme.primitives.color.white
            }
          ]}
        >
          <Text maxFontSizeMultiplier={1.2} variant="caption">{`+${rest}`}</Text>
        </View>
      ) : null}
    </View>
  );
});

export interface TagCloudProps {
  tags: readonly ProfileTag[];
  /**
   * `flat`: todas juntas (compartidas primero) · `grouped`: «En común» con destello y
   * luego el resto por categoría del catálogo (perfil completo).
   */
  layout?: "flat" | "grouped";
  size?: TagStickerSize;
  /** Límite en `flat` (sin límite por defecto). */
  limit?: number;
  /** Las pegatinas compartidas entran con un pop escalonado. */
  animateShared?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Nube de etiquetas de otra persona. Las que compartís van primero y brillan. */
export const TagCloud = memo(function TagCloud({
  tags,
  layout = "flat",
  size = "md",
  limit,
  animateShared = false,
  style,
  testID
}: TagCloudProps) {
  const tintFor = useCategoryTint();
  const shared = useMemo(() => sharedTags([...tags]), [tags]);
  const groups = useMemo(() => groupOtherTagsByCategory([...tags]), [tags]);
  const flat = useMemo(() => sortTagsForDisplay([...tags]).slice(0, limit ?? undefined), [limit, tags]);

  if (tags.length === 0) {
    return null;
  }

  const sticker = (tag: ProfileTag, index: number) => {
    const node = (
      <TagSticker
        key={tag.id}
        emoji={tag.emoji}
        label={tag.label}
        rotate={index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1 : 0}
        size={size}
        state={tag.shared ? "shared" : "neutral"}
        testID={testID ? `${testID}-tag-${tag.slug}` : undefined}
        tint={tag.shared ? undefined : tintFor(tag.category)}
      />
    );

    return tag.shared && animateShared ? (
      <PopIn key={tag.id} delay={stagger(index, 60, 120)} rotate={0}>
        {node}
      </PopIn>
    ) : (
      node
    );
  };

  if (layout === "flat") {
    return (
      <Inline gap="sm" style={style} testID={testID}>
        {flat.map(sticker)}
      </Inline>
    );
  }

  return (
    <Stack gap="lg" style={style} testID={testID}>
      {shared.length > 0 ? (
        <Stack gap="sm">
          <View style={styles.heading}>
            <Sparkle color="limonada" size={18} />
            <Text accessibilityRole="header" variant="label">
              {shared.length === 1 ? "1 en común contigo" : `${shared.length} en común contigo`}
            </Text>
          </View>
          <Inline gap="sm">{shared.map(sticker)}</Inline>
        </Stack>
      ) : null}
      {groups.map((group) => (
        <Stack key={group.category} gap="sm">
          <Text accessibilityRole="header" color="muted" variant="micro">
            {group.label}
          </Text>
          <Inline gap="sm">{group.tags.map((tag, index) => sticker(tag, index))}</Inline>
        </Stack>
      ))}
    </Stack>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    flexWrap: "nowrap",
    minHeight: 36
  },
  measureClip: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0
  },
  measureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: 4000
  },
  cell: {
    flexShrink: 0
  },
  measureCell: {
    flexShrink: 0,
    alignSelf: "flex-start"
  },
  more: {
    height: 26,
    minWidth: 34,
    paddingHorizontal: 7,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  }
});
