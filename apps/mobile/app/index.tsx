import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { useSessionShell } from "../src/features/auth/presentation";

export default function IndexRoute() {
  const { state } = useSessionShell();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.status === "signed-in") {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(public)/login" />;
}
