import { useRouter } from "expo-router";

import { resolveOptionalNavigationEntries } from "../../src/features/optional-modules";
import { useLogoutAction, useSessionShell } from "../../src/features/auth/presentation";
import { useFeatureFlag } from "../../src/shared/config";
import { Button, PlaceholderScreen, Stack, Text, UserSummaryCard } from "../../src/shared/ui";

export default function SettingsRoute() {
  const { state } = useSessionShell();
  const logout = useLogoutAction();
  const router = useRouter();
  const { enabled: subscriptionsEnabled } = useFeatureFlag("subscriptions");

  if (state.status !== "signed-in") {
    return null;
  }

  const optionalNavigationEntries = resolveOptionalNavigationEntries({
    session: state.session,
    features: { subscriptions: subscriptionsEnabled }
  });

  return (
    <PlaceholderScreen
      description="Feature-owned settings actions can adopt the shared UI surface."
      testId="settings-screen"
      title="Settings"
    >
      <UserSummaryCard user={state.session.user} />
      {optionalNavigationEntries.length > 0 ? (
        <Stack>
          <Text>Optional modules</Text>
          {optionalNavigationEntries.map((entry) => (
            <Button key={entry.href} onPress={() => router.push(entry.href)}>
              {entry.label}
            </Button>
          ))}
        </Stack>
      ) : null}
      <Button onPress={() => void logout()}>
        Sign out
      </Button>
    </PlaceholderScreen>
  );
}
