import { EmptyState, PlaceholderScreen } from "../../../src/shared/ui";

export default function HomeRoute() {
  return (
    <PlaceholderScreen
      description="Authenticated shell landing content stays feature-owned."
      testId="home-screen"
      title="Home"
    >
      <EmptyState
        description="Reusable sections can swap themes without changing this route's ownership."
        title="No recent activity"
      />
    </PlaceholderScreen>
  );
}
