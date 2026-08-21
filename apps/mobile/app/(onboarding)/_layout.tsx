import type { PropsWithChildren } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, Slot, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppBootstrap } from "../../src/features/app-bootstrap";
import { useSessionShell } from "../../src/features/auth/presentation";
import { OnboardingStepper } from "../../src/features/onboarding";
import { useTheme } from "../../src/shared/ui/providers/theme-provider";

function OnboardingGuard({ children }: PropsWithChildren) {
  const { state } = useSessionShell();
  const { state: bootstrapState } = useAppBootstrap();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.status === "signed-out") {
    return <Redirect href="/(public)/login" />;
  }

  if (bootstrapState.status === "loading" || bootstrapState.status === "idle") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (bootstrapState.status === "error") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text>{bootstrapState.error}</Text>
      </View>
    );
  }

  if (!bootstrapState.bootstrap.profile.onboardingRequired) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <>{children}</>;
}

export default function OnboardingLayoutRoute() {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.semantic.color.screenBackground }}>
      <OnboardingGuard>
        <View style={{ flex: 1 }}>
          <OnboardingStepper activePath={pathname} />
          <Slot />
        </View>
      </OnboardingGuard>
    </SafeAreaView>
  );
}
