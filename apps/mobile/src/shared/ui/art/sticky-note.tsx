import { memo, type PropsWithChildren, useState } from "react";
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { mixHex } from "./color-utils";
import { WashiTape, type WashiPattern } from "./washi-tape";

export interface StickyNoteProps {
  /** Pastel del papel (def. limonada). */
  color?: PastelName;
  /** Inclinación en grados (def. -2). */
  tilt?: number;
  /** Tira de cinta arriba (def. lavanda de rayas); `false` la quita. */
  tape?: false | { color?: PastelName; pattern?: WashiPattern };
  /** Esquina inferior derecha doblada (def. sí). */
  fold?: boolean;
  /** Relleno interior (def. 16). */
  padding?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FOLD = 22;
const SHADOW = 4;
const RADIUS = 4;

/** Contorno de la nota con la esquina doblada (cortada) y la solapa. */
export function stickyNotePaths(width: number, height: number, fold: boolean) {
  const w = width;
  const h = height;
  const f = fold ? Math.min(FOLD, w / 3, h / 3) : 0;
  const r = RADIUS;
  const body = fold
    ? `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - f}L${w - f} ${h}H${r}Q0 ${h} 0 ${h - r}V${r}Q0 0 ${r} 0Z`
    : `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${r}Q0 0 ${r} 0Z`;
  const flap = fold ? `M${w} ${h - f}L${w - f} ${h}L${w - f + 2} ${h - f + 4}Q${w - f + 3} ${h - f + 1.5} ${w - f + 6} ${h - f + 1}Z` : null;
  return { body, flap };
}

/**
 * Nota adhesiva: papel pastel con contorno de tinta, sombra dura, esquina
 * doblada y una tira de washi arriba. El contenido va dentro (texto, iconos…).
 */
export const StickyNote = memo(function StickyNote({
  children,
  color = "limonada",
  tilt = -2,
  tape = {},
  fold = true,
  padding = 16,
  style,
  testID
}: PropsWithChildren<StickyNoteProps>) {
  const theme = useTheme();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const swatch = theme.primitives.pastel[color];
  const ink = theme.primitives.color.ink;
  const stroke = theme.primitives.border.regular;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!box || Math.abs(box.width - width) > 0.5 || Math.abs(box.height - height) > 0.5) {
      setBox({ width, height });
    }
  };

  const paths = box ? stickyNotePaths(box.width, box.height, fold) : null;
  const tapeWidth = box ? Math.min(Math.max(box.width * 0.36, 56), 112) : 72;

  return (
    <View testID={testID} style={[{ transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <View onLayout={onLayout} style={{ padding, paddingTop: padding + (tape ? 6 : 0), paddingRight: padding + (fold ? 4 : 0) }}>
        {box && paths ? (
          <Svg
            style={{ position: "absolute", left: -stroke, top: -stroke }}
            width={box.width + SHADOW + stroke * 2}
            height={box.height + SHADOW + stroke * 2}
            viewBox={`${-stroke} ${-stroke} ${box.width + SHADOW + stroke * 2} ${box.height + SHADOW + stroke * 2}`}
          >
            <Path d={paths.body} transform={`translate(${SHADOW} ${SHADOW})`} fill={ink} stroke={ink} strokeWidth={stroke} strokeLinejoin="round" />
            <Path d={paths.body} fill={swatch.fill} stroke={ink} strokeWidth={stroke} strokeLinejoin="round" />
            {paths.flap ? (
              <Path d={paths.flap} fill={mixHex(swatch.fill, swatch.deep, 0.22)} stroke={ink} strokeWidth={stroke} strokeLinejoin="round" />
            ) : null}
          </Svg>
        ) : null}
        {children}
      </View>
      {tape ? (
        <View style={{ position: "absolute", top: -11, left: 0, right: 0, alignItems: "center", pointerEvents: "none" }}>
          <WashiTape width={tapeWidth} height={22} color={tape.color ?? "lavanda"} pattern={tape.pattern ?? "stripes"} rotation={-tilt * 1.5 - 3} />
        </View>
      ) : null}
    </View>
  );
});
