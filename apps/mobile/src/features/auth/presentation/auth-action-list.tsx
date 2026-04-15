import type { AuthProvider } from "@snack/mobile-shared";

import { Button, Stack } from "../../../shared/ui";

interface AuthActionListProps {
  busyProvider: AuthProvider | null;
  onSelect(provider: AuthProvider): void;
}

export function AuthActionList({ busyProvider, onSelect }: AuthActionListProps) {
  const disabled = busyProvider !== null;

  return (
    <Stack>
      <Button disabled={disabled} onPress={() => onSelect("google")}>
        Continue with Google
      </Button>
      <Button disabled={disabled} onPress={() => onSelect("apple")}>
        Continue with Apple
      </Button>
    </Stack>
  );
}
