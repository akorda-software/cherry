import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { useAppBootstrap } from "../src/features/app-bootstrap";
import { useSessionShell } from "../src/features/auth/presentation";

export default function IndexRoute() {
  const { state } = useSessionShell();
  const { state: bootstrapState } = useAppBootstrap();

  if (state.status === "loading" || (state.status === "signed-in" && bootstrapState.status === "loading")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.status === "signed-in") {
    if (bootstrapState.status === "error") {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text>{bootstrapState.error}</Text>
        </View>
      );
    }

    if (bootstrapState.status !== "ready") {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (bootstrapState.bootstrap.profile.onboardingRequired) {
      return <Redirect href="/(onboarding)" />;
    }

    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(public)/login" />;
}
