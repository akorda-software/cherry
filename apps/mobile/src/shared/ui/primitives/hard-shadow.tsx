import type { ComponentProps, ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "../providers/theme-provider";
import { type ElevationLevel, elevationOffsets } from "../tokens/primitives/elevation";

type AnimatedViewProps = ComponentProps<typeof Animated.View>;
type AnimatedViewStyle = AnimatedViewProps["style"];

/** Radios que la sombra copia de la cara (esquinas sueltas incluidas: burbujas de chat). */
const RADIUS_KEYS = [
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderTopStartRadius",
  "borderTopEndRadius",
  "borderBottomStartRadius",
  "borderBottomEndRadius",
  "borderStartStartRadius",
  "borderStartEndRadius",
  "borderEndStartRadius",
  "borderEndEndRadius"
] as const;

type RadiusKey = (typeof RADIUS_KEYS)[number];
export type ShadowRadii = Partial<Pick<ViewStyle, RadiusKey>>;

/**
 * Lo que sitúa la pieza en su padre (va en la caja exterior, que lleva cara + sombra):
 * márgenes, posición, tamaño, flex propio, giro y opacidad. Todo lo demás (relleno,
 * contorno, radio, padding, overflow, cómo se colocan los hijos) es de la cara.
 */
const OUTER_KEYS = new Set<string>([
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "marginBlock",
  "marginBlockStart",
  "marginBlockEnd",
  "marginInline",
  "marginInlineStart",
  "marginInlineEnd",
  "position",
  "top",
  "bottom",
  "left",
  "right",
  "start",
  "end",
  "inset",
  "insetBlock",
  "insetBlockStart",
  "insetBlockEnd",
  "insetInline",
  "insetInlineStart",
  "insetInlineEnd",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "transform",
  "transformOrigin",
  "zIndex",
  "elevation",
  "opacity",
  "display",
  "pointerEvents"
]);

export interface SplitShadowStyle {
  /** Caja exterior: colocación en el padre. */
  outer: ViewStyle;
  /** Cara: aspecto y maquetación del contenido. */
  face: ViewStyle;
  /** Radios de la cara, para que la sombra tenga la misma silueta. */
  radii: ShadowRadii;
  /** El tamaño lo fija el estilo (alto, flex, proporción, top+bottom): la cara lo llena. */
  sized: boolean;
}

/** Reparte un estilo de «pieza con sombra» entre la caja exterior y la cara. */
export function splitShadowStyle(style: StyleProp<ViewStyle>): SplitShadowStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const face: Record<string, unknown> = {};
  const radii: Record<string, unknown> = {};

  for (const key of Object.keys(flat)) {
    const value = flat[key];
    if (value === undefined) {
      continue;
    }
    if (OUTER_KEYS.has(key)) {
      outer[key] = value;
    } else {
      face[key] = value;
    }
    if ((RADIUS_KEYS as readonly string[]).includes(key)) {
      radii[key] = value;
    }
  }

  const grows = (value: unknown) => typeof value === "number" && value > 0;
  const sized =
    outer.height != null ||
    outer.minHeight != null ||
    outer.maxHeight != null ||
    outer.aspectRatio != null ||
    outer.flexBasis != null ||
    grows(outer.flex) ||
    grows(outer.flexGrow) ||
    (outer.top != null && outer.bottom != null);

  return { outer: outer as ViewStyle, face: face as ViewStyle, radii: radii as ShadowRadii, sized };
}

export interface HardShadowLayerProps {
  /** Nivel de sombra; `none` no pinta nada. */
  elevation: ElevationLevel;
  /** Radio (número) o radios por esquina de la cara. */
  radius?: number | ShadowRadii;
  /** Tinta por defecto. */
  color?: string;
  /** Estilo animado de la sombra (p. ej. encogerla al pulsar). */
  animatedStyle?: AnimatedViewStyle;
}

/**
 * Sombra dura suelta: una vista de tinta, sin desenfoque, desplazada abajo a la
 * derecha. Va como PRIMER hijo (detrás) de una caja cuyo tamaño es el de la cara.
 * Para piezas propias que ya tienen su caja; lo normal es usar `HardShadow`.
 */
export function HardShadowLayer({ elevation, radius, color, animatedStyle }: HardShadowLayerProps) {
  const theme = useTheme();
  const offset = elevationOffsets[elevation];

  if (!offset) {
    return null;
  }

  const style: StyleProp<ViewStyle> = [
    styles.shadow,
    {
      top: offset,
      left: offset,
      right: -offset,
      bottom: -offset,
      backgroundColor: color ?? theme.primitives.color.ink
    },
    typeof radius === "number" ? { borderRadius: radius } : radius
  ];

  return animatedStyle ? <Animated.View style={[style, animatedStyle]} /> : <View style={style} />;
}

export interface HardShadowProps extends Omit<AnimatedViewProps, "style" | "children"> {
  children?: ReactNode;
  /** Sombra dura (por defecto `md`). `none` = sin sombra (la estructura no cambia). */
  elevation?: ElevationLevel;
  /** Color de la sombra (tinta por defecto). */
  shadowColor?: string;
  /** Radio de la sombra; por defecto el/los de la cara. */
  radius?: number;
  /**
   * Estilo completo de la pieza, como si fuera una sola vista: se reparte solo entre la
   * caja exterior (márgenes, posición, tamaño, flex, giro, opacidad) y la cara (resto).
   */
  style?: StyleProp<ViewStyle>;
  /** Estilo extra solo para la cara. */
  faceStyle?: StyleProp<ViewStyle>;
  /** Estilo animado (Reanimated) de la caja exterior: giros, escalas, opacidad. */
  animatedStyle?: AnimatedViewStyle;
  /** Estilo animado de la cara (p. ej. hundirse hacia la sombra). */
  animatedFaceStyle?: AnimatedViewStyle;
  /** Estilo animado de la sombra. */
  animatedShadowStyle?: AnimatedViewStyle;
  /**
   * La cara llena el alto de la caja exterior. Se activa solo cuando el estilo fija el alto
   * (height, minHeight, flex, aspectRatio, top+bottom); pásalo si el alto lo da el padre
   * (fila con `alignItems: stretch`). Nunca por defecto: una cara con `flexGrow` dentro
   * de un ScrollView se estiraba miles de px en Android.
   */
  fill?: boolean;
  /** Fuerza la caja exterior animada (p. ej. para `entering`/`exiting`). */
  animated?: boolean;
}

/**
 * Pieza con sombra dura neobrutal SIN `boxShadow`: caja exterior (colocación) con
 * la sombra como vista hermana detrás y la cara (relleno, contorno, contenido) encima.
 * En Android `boxShadow` es caro de pintar (el mazo de Descubrir iba a tirones); una
 * vista de color no cuesta casi nada. Mismo aspecto en todas las plataformas.
 */
export function HardShadow({
  children,
  elevation = "md",
  shadowColor,
  radius,
  style,
  faceStyle,
  animatedStyle,
  animatedFaceStyle,
  animatedShadowStyle,
  fill,
  animated,
  ...rest
}: HardShadowProps) {
  const { outer, face, radii, sized } = splitShadowStyle(style);
  const extraFace = faceStyle ? StyleSheet.flatten(faceStyle) : undefined;
  const shadowRadius: number | ShadowRadii = radius ?? (extraFace ? { ...radii, ...pickRadii(extraFace) } : radii);
  const faceFills = fill ?? sized;

  const Outer =
    animated || animatedStyle || rest.entering || rest.exiting || rest.layout ? Animated.View : (View as typeof Animated.View);
  const Face = animatedFaceStyle ? Animated.View : (View as typeof Animated.View);

  return (
    <Outer {...rest} style={animatedStyle ? [outer, animatedStyle] : outer}>
      <HardShadowLayer animatedStyle={animatedShadowStyle} color={shadowColor} elevation={elevation} radius={shadowRadius} />
      <Face style={[face, faceFills ? styles.fill : null, extraFace, animatedFaceStyle]}>{children}</Face>
    </Outer>
  );
}

function pickRadii(style: ViewStyle): ShadowRadii {
  const out: Record<string, unknown> = {};
  for (const key of RADIUS_KEYS) {
    if (style[key] !== undefined) {
      out[key] = style[key];
    }
  }
  return out as ShadowRadii;
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    pointerEvents: "none"
  },
  fill: {
    flexGrow: 1,
    flexShrink: 1
  }
});
