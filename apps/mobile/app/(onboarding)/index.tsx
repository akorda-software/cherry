import { EmptyState, PlaceholderScreen } from "../../src/shared/ui";

export default function OnboardingIndexRoute() {
  return (
    <PlaceholderScreen
      description="The server draft profile is ready. The next step will replace this placeholder with the real onboarding form flow."
      testId="onboarding-placeholder-screen"
      title="Complete your profile"
    >
      <EmptyState
        description="We'll build the draft-profile steps here: basics, preferences, location, photos, and final review."
        title="Onboarding starts here"
      />
    </PlaceholderScreen>
  );
}
