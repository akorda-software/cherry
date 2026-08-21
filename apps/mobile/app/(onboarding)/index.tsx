import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { useAppBootstrap } from "../../src/features/app-bootstrap";

function stepToRoute(step: string | null | undefined): string {
  switch (step) {
    case "name":
    case "birth_date":
    case "gender":
    case "intent":
      return "/(onboarding)/profile";
    case "bio":
    case "photos":
      return "/(onboarding)/bio";
    case "interested_in":
    case "discovery_preferences":
    case "location":
      return "/(onboarding)/preferences";
    case "tags":
      return "/(onboarding)/tags";
    default:
      return "/(app)/(tabs)/home";
  }
}

export default function OnboardingIndexRoute() {
  const { state } = useAppBootstrap();

  if (state.status === "loading" || state.status === "idle") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.status === "error") {
    return <Redirect href="/(public)/login" />;
  }

  if (!state.bootstrap.profile.onboardingRequired) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href={stepToRoute(state.bootstrap.profile.nextOnboardingStep)} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" }
});
