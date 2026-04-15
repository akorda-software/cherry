import type { PropsWithChildren } from "react";

import { Button } from "../../../shared/ui";
import { Heading } from "../../../shared/ui/primitives/heading";
import { Stack } from "../../../shared/ui/primitives/stack";
import { Text } from "../../../shared/ui/primitives/text";
import { canAccess } from "../domain/access-rules";

interface PaywallProps extends PropsWithChildren {
  featureFlagEnabled: boolean;
  subscribed: boolean;
  onSubscribe?: () => void;
}

export function Paywall({ children, featureFlagEnabled, subscribed, onSubscribe }: PaywallProps) {
  if (canAccess({ subscribed, featureFlagEnabled })) {
    return <>{children}</>;
  }

  return (
    <Stack>
      <Heading>Upgrade to Pro</Heading>
      <Text>Subscribe to access this feature</Text>
      {onSubscribe ? (
        <Button onPress={onSubscribe}>Subscribe</Button>
      ) : (
        <Button disabled>Subscribe</Button>
      )}
    </Stack>
  );
}
