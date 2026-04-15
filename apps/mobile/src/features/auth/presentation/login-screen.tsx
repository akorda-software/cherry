import { useEffect } from "react";
import { useRouter } from "expo-router";

import { Card, FormMessage, Screen } from "../../../shared/ui";
import { AuthActionList } from "./auth-action-list";
import { useSessionShell } from "./session-shell-provider";

const homePath = "/(app)/(tabs)/home";

export function LoginScreen() {
  const router = useRouter();
  const { state, signInWith } = useSessionShell();

  useEffect(() => {
    if (state.status === "signed-in") {
      router.replace(homePath);
    }
  }, [router, state]);

  const busyProvider = state.status === "signed-out" ? state.busyProvider : null;

  return (
    <Screen
      description="Theme-driven auth presentation stays generic while the feature owns behavior."
      title="Welcome to Snack"
    >
      <Card
        description="Reusable auth access for the current app shell."
        title="Sign in to continue"
      >
        <AuthActionList busyProvider={busyProvider} onSelect={(provider) => void signInWith(provider)} />
        {busyProvider ? <FormMessage tone="info">{`Signing in with ${busyProvider === "google" ? "Google" : "Apple"}…`}</FormMessage> : null}
        {state.status === "signed-out" && state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      </Card>
    </Screen>
  );
}

export default LoginScreen;
