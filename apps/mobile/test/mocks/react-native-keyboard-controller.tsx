import type { PropsWithChildren } from "react";
import { View } from "react-native";

/** Doble de react-native-keyboard-controller en jsdom: sin teclado nativo, simples contenedores. */
export function KeyboardProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function KeyboardAvoidingView({ children, style, testID }: PropsWithChildren<{ style?: unknown; testID?: string }>) {
  return (
    <View style={style as never} testID={testID}>
      {children}
    </View>
  );
}
