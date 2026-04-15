import { useLogoutAction, useSessionShell } from "../../../src/features/auth/presentation";
import { Button, PlaceholderScreen, UserSummaryCard } from "../../../src/shared/ui";

export default function ProfileRoute() {
  const { state } = useSessionShell();
  const logout = useLogoutAction();

  if (state.status !== "signed-in") {
    return null;
  }

  return (
    <PlaceholderScreen
      description="Account details for the current signed-in user."
      testId="profile-screen"
      title="Profile"
    >
      <UserSummaryCard user={state.session.user} />
      <Button onPress={() => void logout()} tone="destructive">
        Logout
      </Button>
    </PlaceholderScreen>
  );
}
