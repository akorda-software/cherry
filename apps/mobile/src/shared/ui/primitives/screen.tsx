import type { ReactElement, ReactNode } from "react";
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarSpace } from "../app-shell/tab-bar-space";
import { PaperBackground } from "../art";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { Heading } from "./heading";
import { createContentWidth } from "./shared";
import { resolveSpacing, type SpacingKey } from "./stack";
import { Text } from "./text";

export type ScreenEdge = "top" | "bottom" | "left" | "right";

export interface ScreenProps {
  children?: ReactNode;
  /** Papel teñido con el soft de un pastel (pasos del onboarding, secciones). */
  tone?: PastelName;
  /** Trama de puntos (por defecto sí). */
  dotted?: boolean;
  /** Contenido desplazable. */
  scroll?: boolean;
  /** Margen lateral de página (por defecto sí). */
  padded?: boolean;
  /** Bordes que respetan la safe area (por defecto todos). Sin `bottom` tampoco reserva el hueco de la barra de pestañas. */
  edges?: readonly ScreenEdge[];
  /** Cabecera fija arriba (normalmente `<TopBar />`). */
  header?: ReactNode;
  /** Pie fijo abajo, sobre el teclado (CTAs). */
  footer?: ReactNode;
  /** Evita que el teclado tape el contenido y el pie (por defecto sí). */
  keyboard?: boolean;
  /** Separación entre hijos del contenido (por defecto `lg`). */
  gap?: SpacingKey | number;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle" | "refreshControl">;
  refreshControl?: ReactElement<any>;
  testID?: string;
  /** @deprecated usa `testID`. */
  testId?: string;
  /** @deprecated usa `header={<TopBar title=… size="large" />}`. */
  title?: string;
  /** @deprecated */
  description?: string;
}

const ALL_EDGES: readonly ScreenEdge[] = ["top", "bottom", "left", "right"];

/**
 * Página de la libreta: papel de puntos, safe areas, teclado y un pie fijo
 * para las acciones. Dentro de las pestañas deja sitio a la barra flotante.
 */
export function Screen({
  children,
  tone,
  dotted = true,
  scroll = false,
  padded = true,
  edges = ALL_EDGES,
  header,
  footer,
  keyboard = true,
  gap = "lg",
  contentStyle,
  style,
  scrollProps,
  refreshControl,
  testID,
  testId,
  title,
  description
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const has = (edge: ScreenEdge) => edges.includes(edge);

  const top = has("top") ? insets.top : 0;
  // Sin el borde «bottom», la pantalla no reserva nada abajo (p. ej. una lista propia que
  // pasa por detrás de la barra de pestañas y añade `useTabBarSpace()` a su contenido).
  const bottomInset = has("bottom") ? (tabSpace > 0 ? tabSpace : insets.bottom) : 0;
  const side = padded ? theme.semantic.layout.screenPadding : 0;
  const spacing = theme.primitives.spacing;

  const legacyIntro =
    title || description ? (
      <View style={styles.intro}>
        {title ? <Heading level={1}>{title}</Heading> : null}
        {description ? <Text color="muted">{description}</Text> : null}
      </View>
    ) : null;

  const content: ViewStyle = {
    ...createContentWidth(theme),
    gap: resolveSpacing(spacing, gap),
    paddingHorizontal: side,
    paddingTop: header ? spacing.sm : top + spacing.md,
    paddingBottom: footer ? spacing.lg : bottomInset + spacing.lg
  };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[content, styles.grow, contentStyle]}
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      style={styles.flex}
      {...scrollProps}
    >
      {legacyIntro}
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, content, contentStyle]}>
      {legacyIntro}
      {children}
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.semantic.color.screenBackground,
          paddingLeft: has("left") ? insets.left : 0,
          paddingRight: has("right") ? insets.right : 0
        },
        style
      ]}
      testID={testID ?? testId}
    >
      <PaperBackground dotted={dotted} tone={tone} />
      <KeyboardAvoidingView behavior="padding" enabled={keyboard} style={styles.flex}>
        {header ? <View style={[styles.header, { paddingTop: top }]}>{header}</View> : null}
        {body}
        {footer ? (
          <View
            style={[
              createContentWidth(theme),
              styles.footer,
              { paddingHorizontal: side, paddingBottom: bottomInset + spacing.md, gap: spacing.sm }
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  grow: {
    flexGrow: 1
  },
  header: {
    zIndex: 1
  },
  intro: {
    gap: 8
  },
  footer: {
    paddingTop: 12
  }
});
