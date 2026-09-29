import { Redirect } from "expo-router";

import { refreshBootstrap, useAppBootstrap } from "../src/features/app-bootstrap";
import { useSessionShell } from "../src/features/auth/presentation";
import { appShellRoutes, ErrorState, LoadingScreen, Screen } from "../src/shared/ui";

export default function IndexRoute() {
  const { state } = useSessionShell();
  const { state: bootstrapState } = useAppBootstrap();

  if (state.status === "loading" || (state.status === "signed-in" && bootstrapState.status === "loading")) {
    return <LoadingScreen testID="boot-loading" />;
  }

  if (state.status === "signed-in") {
    if (bootstrapState.status === "error") {
      return (
        <Screen>
          <ErrorState
            message="No hemos podido abrir tu libreta. Revisa tu conexión y vuelve a intentarlo."
            onRetry={() => void refreshBootstrap()}
            testID="boot-error"
          />
        </Screen>
      );
    }

    if (bootstrapState.status !== "ready") {
      return <LoadingScreen testID="boot-loading" />;
    }

    if (bootstrapState.bootstrap.profile.onboardingRequired) {
      return <Redirect href={appShellRoutes.onboarding} />;
    }

    return <Redirect href={appShellRoutes.discover} />;
  }

  return <Redirect href={appShellRoutes.login} />;
}
