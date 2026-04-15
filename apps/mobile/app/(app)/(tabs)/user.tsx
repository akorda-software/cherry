import { useSessionShell } from "../../../src/features/auth/presentation";
import { PlaceholderScreen, UserSummaryCard } from "../../../src/shared/ui";

export default function UserRoute() {
  const { state } = useSessionShell();

  if (state.status !== "signed-in") {
    return null;
  }

  return (
    <PlaceholderScreen
      description="Session-owned account details stay wired by the route layer."
      testId="user-screen"
      title="User details"
    >
      <UserSummaryCard user={state.session.user} />
    </PlaceholderScreen>
  );
}
