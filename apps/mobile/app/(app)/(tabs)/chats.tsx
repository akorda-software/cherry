import { ChatsScreen } from "../../../src/features/matches/presentation/chats-screen";
import { useVerificationPending, VerificationPendingState } from "../../../src/features/verification";
import { Screen } from "../../../src/shared/ui";

export default function ChatsRoute() {
  const pending = useVerificationPending();

  return pending ? (
    <Screen edges={["top"]} testID="chats-verification-pending">
      <VerificationPendingState context="chats" />
    </Screen>
  ) : (
    <ChatsScreen />
  );
}
