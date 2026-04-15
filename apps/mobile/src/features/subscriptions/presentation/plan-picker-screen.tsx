import type { Plan } from "@snack/contracts";

import { Button } from "../../../shared/ui";
import { Card } from "../../../shared/ui";
import { EmptyState } from "../../../shared/ui";
import { FormMessage } from "../../../shared/ui";
import { Screen } from "../../../shared/ui/primitives/screen";
import { Stack } from "../../../shared/ui/primitives/stack";
import { Text } from "../../../shared/ui/primitives/text";

interface PlanPickerScreenProps {
  plans: Plan[];
  loading: boolean;
  error: string | null;
  onSubscribe(planId: string): void;
  onRetry?(): void;
  subscribing?: boolean;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  return `${currency === "usd" ? "$" : ""}${amount.toFixed(2)}`;
}

function formatInterval(interval: string): string {
  return interval === "month" ? "month" : "year";
}

export function PlanPickerScreen({
  plans,
  loading,
  error,
  onSubscribe,
  onRetry,
  subscribing
}: PlanPickerScreenProps) {
  if (loading) {
    return (
      <Screen title="Choose a Plan">
        <FormMessage tone="info">Loading plans…</FormMessage>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Choose a Plan">
        <EmptyState
          title="Something went wrong"
          description={error}
          action={onRetry ? <Button onPress={onRetry}>Retry</Button> : undefined}
        />
      </Screen>
    );
  }

  if (plans.length === 0) {
    return (
      <Screen title="Choose a Plan">
        <EmptyState
          title="No plans available"
          description="Enable billing plans in the backend before exposing subscriptions in this app."
          action={onRetry ? <Button onPress={onRetry}>Refresh</Button> : undefined}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Choose a Plan">
      <Stack>
        {plans.map((plan) => (
          <Card key={plan.id} title={plan.name}>
            <Text>{`${formatPrice(plan.amountCents, plan.currency)}/${formatInterval(plan.interval)}`}</Text>
            <Button disabled={subscribing} onPress={() => onSubscribe(plan.id)}>
              Subscribe
            </Button>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
