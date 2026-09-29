import { type Href, useRouter } from "expo-router";
import { isValidElement, type ReactNode, useState } from "react";
import { type LayoutChangeEvent, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { IconButton } from "../primitives/icon-button";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";

export interface TopBarProps {
  title?: string;
  /** Texto bajo el título grande. */
  subtitle?: string;
  /** normal = barra con título centrado · large = título Mochiy grande bajo la barra. */
  size?: "normal" | "large";
  /** `back` (flecha), `close` (✕) o un nodo propio. */
  left?: "back" | "close" | ReactNode;
  /** Acciones a la derecha (normalmente `IconButton` size="sm"). */
  right?: ReactNode;
  /** Sustituye el comportamiento por defecto de atrás/cerrar. */
  onBack?(): void;
  /** Adónde ir si no hay pantalla anterior (por defecto `/`). */
  fallbackHref?: Href;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Cabecera de pantalla: atrás/cerrar a la izquierda, acciones a la derecha y
 * título Mochiy. Atrás usa `router.back()` y, si no hay historial, `fallbackHref`.
 */
export function TopBar({ title, subtitle, size = "normal", left, right, onBack, fallbackHref = "/", testID, style }: TopBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const side = theme.semantic.layout.screenPadding;
  const [sides, setSides] = useState({ left: 44, right: 44 });

  function measure(which: "left" | "right") {
    return (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setSides((current) => (current[which] === width ? current : { ...current, [which]: width }));
    };
  }

  // El título centrado nunca pisa las acciones: se aparta lo que ocupe el lado más ancho.
  const titleInset = side - 4 + Math.max(sides.left, sides.right) + 8;

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }

    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }

  const leftNode =
    left === "back" ? (
      <IconButton accessibilityLabel="Volver" icon="arrow-left" onPress={goBack} size="sm" testID="top-bar-back" />
    ) : left === "close" ? (
      <IconButton accessibilityLabel="Cerrar" icon="close" onPress={goBack} size="sm" testID="top-bar-close" />
    ) : isValidElement(left) ? (
      left
    ) : null;

  const large = size === "large";

  if (large && !leftNode) {
    return (
      <View style={[styles.root, styles.largeRow, { paddingHorizontal: side }, style]} testID={testID}>
        <View style={styles.large}>
          {title ? (
            <Text aria-level={1} role="heading" variant="title1">
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text color="muted">{subtitle}</Text> : null}
        </View>
        {right ? <View style={[styles.side, styles.inlineRight]}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View style={[styles.row, { paddingHorizontal: side - 4 }]}>
        <View onLayout={measure("left")} style={styles.side}>
          {leftNode}
        </View>
        {!large && title ? (
          <View style={[styles.center, { left: titleInset, right: titleInset }]}>
            <Text align="center" numberOfLines={1} role="heading" variant="title3">
              {title}
            </Text>
          </View>
        ) : null}
        <View onLayout={measure("right")} style={[styles.side, styles.right]}>
          {right}
        </View>
      </View>
      {large && title ? (
        <View style={[styles.large, { paddingHorizontal: side, paddingTop: 4 }]}>
          <Text aria-level={1} role="heading" variant="title1">
            {title}
          </Text>
          {subtitle ? <Text color="muted">{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 8
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  side: {
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  right: {
    marginLeft: "auto",
    justifyContent: "flex-end"
  },
  center: {
    position: "absolute",
    alignItems: "center",
    pointerEvents: "none"
  },
  large: {
    flex: 1,
    gap: 4
  },
  largeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 14
  },
  inlineRight: {
    marginTop: -2
  }
});
