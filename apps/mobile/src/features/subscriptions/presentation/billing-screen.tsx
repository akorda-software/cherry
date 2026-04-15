import type { Subscription } from "@snack/contracts";

import { Button } from "../../../shared/ui";
import { Card } from "../../../shared/ui";
import { Screen } from "../../../shared/ui/primitives/screen";
import { Stack } from "../../../shared/ui/primitives/stack";
import { Text } from "../../../shared/ui/primitives/text";

interface BillingScreenProps {
  subscription: Subscription;
  planName: string;
  onCancel(): void;
  canceling?: boolean;
  error?: string | null;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function BillingScreen({
  subscription,
  planName,
  onCancel,
  canceling,
  error = null
}: BillingScreenProps) {
  return (
    <Screen title="Subscription">
      <Card title="Current Plan">
        <Stack>
          <Text>{planName}</Text>
          {subscription.status === "pending" ? (
            <FormMessage tone="info">
              Your payment is processing. Refresh in a moment to see the latest status.
            </FormMessage>
          ) : null}
          <Text>
            {subscription.cancelAtPeriodEnd
              ? `Cancels on ${formatDate(subscription.currentPeriodEnd)}`
              : `Renews on ${formatDate(subscription.currentPeriodEnd)}`}
          </Text>
          {error ? <FormMessage tone="critical">{error}</FormMessage> : null}
          {subscription.status === "canceling" || subscription.cancelAtPeriodEnd ? (
            <FormMessage tone="info">
              Your subscription will remain active until {formatDate(subscription.currentPeriodEnd)}
            </FormMessage>
          ) : null}
          {!subscription.cancelAtPeriodEnd &&
          subscription.status !== "canceling" &&
          subscription.status !== "pending" ? (
            <Button tone="destructive" disabled={canceling} onPress={onCancel}>
              Cancel Subscription
            </Button>
          ) : null}
        </Stack>
      </Card>
    </Screen>
  );
}

import { FormMessage } from "../../../shared/ui";
