import { StyleSheet, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";

import { Text, useTheme } from "../../../shared/ui";

const W = 240;
const H = 152;

/**
 * Cara de la foto de un DNI esquemático, con el CAN (6 cifras) marcado abajo a la derecha.
 * Geométrico, sin ningún dato real.
 */
export function CanLocationArt() {
  const theme = useTheme();
  const ink = theme.primitives.color.ink;
  const card = theme.primitives.pastel.cielo;
  const mark = theme.primitives.pastel.limonada;

  return (
    <View
      accessibilityLabel="Dibujo de un DNI por la cara de la foto, con el CAN marcado abajo a la derecha"
      accessible
      style={styles.wrap}
      testID="can-location-art"
    >
      <Svg height={H + 6} viewBox={`0 0 ${W + 6} ${H + 6}`} width={W + 6}>
        {/* Sombra dura y tarjeta */}
        <Rect fill={ink} height={H} rx={14} width={W} x={5} y={5} />
        <Rect fill={card.soft} height={H} rx={14} stroke={ink} strokeWidth={3} width={W} x={1.5} y={1.5} />
        {/* Foto */}
        <Rect fill={theme.primitives.color.white} height={70} rx={8} stroke={ink} strokeWidth={2} width={54} x={16} y={34} />
        <Circle cx={43} cy={60} fill={card.fill} r={12} stroke={ink} strokeWidth={2} />
        <Rect fill={card.fill} height={18} rx={9} stroke={ink} strokeWidth={2} width={36} x={25} y={78} />
        {/* Líneas de texto */}
        <Rect fill={ink} height={8} opacity={0.18} rx={4} width={120} x={84} y={18} />
        {[40, 56, 72, 88].map((y, index) => (
          <Rect fill={ink} height={7} key={y} opacity={0.14} rx={3.5} width={index % 2 === 0 ? 104 : 80} x={84} y={y} />
        ))}
        {/* CAN */}
        <Rect fill={mark.fill} height={26} rx={7} stroke={ink} strokeWidth={2.5} width={74} x={156} y={114} />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Rect fill={ink} height={10} key={index} rx={2} width={6} x={164 + index * 10} y={122} />
        ))}
      </Svg>
      <Text align="center" color="muted" variant="caption">
        El CAN: 6 cifras, abajo a la derecha
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 }
});
