import { LikesScreen } from "../../../src/features/likes/presentation/likes-screen";
import { useVerificationPending, VerificationPendingState } from "../../../src/features/verification";
import { Screen } from "../../../src/shared/ui";

export default function LikesRoute() {
  const pending = useVerificationPending();

  return pending ? (
    <Screen edges={["top"]} testID="likes-verification-pending">
      <VerificationPendingState context="likes" />
    </Screen>
  ) : (
    <LikesScreen />
  );
}
