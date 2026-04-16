import { useState } from "react";
import { Redirect } from "expo-router";

import {
  BillingScreen,
  PlanPickerScreen,
  SubscriptionFeatureProvider,
  useSubscriptionShell
} from "../../src/features/subscriptions/presentation";
import {
  SubscriptionStripeProvider,
  useStripePaymentSheet
} from "../../src/features/subscriptions/infrastructure";
import { useFeatureFlag, useRuntimeConfig } from "../../src/shared/config";
import { Screen } from "../../src/shared/ui/primitives/screen";
import { Text } from "../../src/shared/ui/primitives/text";

export function SubscriptionsRouteContent() {
  const { enabled, loading: featureFlagLoading } = useFeatureFlag("subscriptions");
  const { state, subscribeToPlan, abandonPendingCheckout, cancelSubscription, refresh } =
    useSubscriptionShell();
  const paymentSheet = useStripePaymentSheet();
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    setSubscribing(true);
    setActionError(null);

    try {
      const checkoutSession = await subscribeToPlan(planId);
      const result = await paymentSheet.presentCheckout(checkoutSession);

      if (result.status === "completed") {
        await refresh();
        return;
      }

      await abandonPendingCheckout(checkoutSession.pendingSubscriptionId);

      if (result.status === "failed") {
        setActionError(result.message);
      }
    } finally {
      setSubscribing(false);
    }
  }

  async function handleCancel() {
    setCanceling(true);
    setActionError(null);

    try {
      await cancelSubscription();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to cancel subscription");
    } finally {
      setCanceling(false);
    }
  }

  if (featureFlagLoading) {
    return (
      <Screen title="Subscription">
        <Text>Loading…</Text>
      </Screen>
    );
  }

  if (!enabled) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  if (state.status === "loading") {
    return (
      <Screen title="Subscription">
        <Text>Loading…</Text>
      </Screen>
    );
  }

  if (state.status === "disabled") {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  if (state.status === "error") {
    return (
      <PlanPickerScreen
        plans={[]}
        loading={false}
        error={actionError ?? state.error}
        onSubscribe={() => {}}
        onRetry={() => void refresh()}
      />
    );
  }

  if (state.status === "subscribed" && state.subscription) {
    const plan = state.plans.find((p) => p.id === state.subscription.planId);

    return (
      <BillingScreen
        subscription={state.subscription}
        planName={plan?.name ?? "Current subscription"}
        onCancel={() => void handleCancel()}
        canceling={canceling}
        error={actionError}
      />
    );
  }

  return (
    <PlanPickerScreen
      plans={state.plans}
      loading={false}
      error={actionError}
      onSubscribe={(planId) => void handleSubscribe(planId)}
      onRetry={() => void refresh()}
      subscribing={subscribing}
    />
  );
}

export default function SubscriptionsRoute() {
  const { bootstrapConfig } = useRuntimeConfig();

  return (
    <SubscriptionStripeProvider stripeConfig={bootstrapConfig?.services?.stripe ?? null}>
      <SubscriptionFeatureProvider>
        <SubscriptionsRouteContent />
      </SubscriptionFeatureProvider>
    </SubscriptionStripeProvider>
  );
}
