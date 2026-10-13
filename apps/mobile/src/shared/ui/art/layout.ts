import type { ViewStyle } from "react-native";

/** Equivalente a `StyleSheet.absoluteFill` (sin depender del objeto de RN en tests). */
export const absoluteFill: ViewStyle = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };
