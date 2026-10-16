import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { Divider, elevationOffsets, useTheme } from "../../../shared/ui";
import { ConversationRow, type ConversationRowProps } from "./conversation-row";

interface GroupedConversationRowProps extends ConversationRowProps {
  first: boolean;
  last: boolean;
}

/** Segmento de la misma Surface agrupada: permite reciclar filas sin montar la tarjeta entera. */
export const GroupedConversationRow = memo(function GroupedConversationRow({
  first,
  last,
  ...row
}: GroupedConversationRowProps) {
  const theme = useTheme();
  const { color, border, radius } = theme.primitives;
  const shadowOffset = elevationOffsets.md;
  const corners = {
    borderTopLeftRadius: first ? radius.lg : 0,
    borderTopRightRadius: first ? radius.lg : 0,
    borderBottomLeftRadius: last ? radius.lg : 0,
    borderBottomRightRadius: last ? radius.lg : 0
  };

  return (
    <View style={{ marginHorizontal: theme.semantic.layout.screenPadding }}>
      {/* Sin solapar segmentos: FlashList puede reciclar sus vistas en distinto orden de pintura. */}
      <View
        pointerEvents="none"
        style={[
          styles.shadow,
          corners,
          {
            backgroundColor: color.ink,
            top: first ? shadowOffset : 0,
            bottom: last ? -shadowOffset : 0,
            left: shadowOffset,
            right: -shadowOffset
          }
        ]}
        testID={`conversation-shadow-${row.match.id}`}
      />
      <View
        style={[
          styles.face,
          corners,
          {
            backgroundColor: color.white,
            borderColor: color.ink,
            borderLeftWidth: border.bold,
            borderRightWidth: border.bold,
            borderTopWidth: first ? border.bold : 0,
            borderBottomWidth: last ? border.bold : 0
          }
        ]}
        testID={`conversation-group-${row.match.id}`}
      >
        {!first ? <Divider style={styles.divider} /> : null}
        <ConversationRow {...row} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shadow: { position: "absolute" },
  face: { overflow: "hidden" },
  divider: { marginHorizontal: 16 }
});
