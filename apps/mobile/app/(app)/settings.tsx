import { useLogoutAction, useSessionShell } from "../../src/features/auth/presentation";
import { Button, PlaceholderScreen, UserSummaryCard } from "../../src/shared/ui";

export default function SettingsRoute() {
  const { state } = useSessionShell();
  const logout = useLogoutAction();

  if (state.status !== "signed-in") {
    return null;
  }

  return (
    <PlaceholderScreen
      description="Feature-owned settings actions can adopt the shared UI surface."
      testId="settings-screen"
      title="Settings"
    >
      <UserSummaryCard user={state.session.user} />
      <Button onPress={() => void logout()}>
        Sign out
      </Button>
    </PlaceholderScreen>
  );
}
