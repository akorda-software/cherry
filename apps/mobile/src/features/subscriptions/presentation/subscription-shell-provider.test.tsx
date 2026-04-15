import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Plan, Subscription } from "@snack/contracts";
import {
  SubscriptionShellProvider,
  useSubscriptionShell
} from "./subscription-shell-provider";

function SubscriptionProbe() {
  const { state } = useSubscriptionShell();

  return <output data-testid="sub-state">{JSON.stringify(state)}</output>;
}

const plans: Plan[] = [
  {
    id: "plan-1",
    name: "Pro",
    amountCents: 999,
    currency: "usd",
    interval: "month",
    stripePriceId: "price_abc"
  }
];

const subscription: Subscription = {
  id: "sub-1",
  planId: "plan-1",
  status: "active",
  currentPeriodEnd: "2026-05-01T00:00:00Z",
  cancelAtPeriodEnd: false
};

function createMockServices(overrides?: Record<string, unknown>) {
  return {
    featureFlagEnabled: true,
    fetchPlans: vi.fn(async () => plans),
    getSubscription: vi.fn(async () => ({ subscribed: true, subscription })),
    subscribe: vi.fn(async () => ({
      customerId: "cus_123",
      customerEphemeralKeySecret: "ek_test_123",
      pendingSubscriptionId: "sub_pending_123",
      paymentIntentClientSecret: "pi_test_secret_123"
    })),
    abandonPendingSubscription: vi.fn(async () => ({ status: "abandoned" })),
    cancel: vi.fn(async () => ({ status: "canceling" })),
    ...overrides
  };
}

describe("SubscriptionShellProvider", () => {
  it("transitions from loading to subscribed after fetching status", async () => {
    const services = createMockServices();

    render(
      <SubscriptionShellProvider services={services}>
        <SubscriptionProbe />
      </SubscriptionShellProvider>
    );

    await waitFor(() => {
      const output = screen.getByTestId("sub-state");
      const state = JSON.parse(output.textContent ?? "{}");
      expect(state.status).toBe("subscribed");
      expect(state.subscription).toEqual(subscription);
      expect(state.plans).toEqual(plans);
    });
  });

  it("transitions from loading to unsubscribed when no subscription exists", async () => {
    const services = createMockServices({
      getSubscription: vi.fn(async () => ({ subscribed: false }))
    });

    render(
      <SubscriptionShellProvider services={services}>
        <SubscriptionProbe />
      </SubscriptionShellProvider>
    );

    await waitFor(() => {
      const output = screen.getByTestId("sub-state");
      const state = JSON.parse(output.textContent ?? "{}");
      expect(state.status).toBe("unsubscribed");
      expect(state.plans).toEqual(plans);
    });
  });

  it("transitions to error when API calls fail", async () => {
    const services = createMockServices({
      fetchPlans: vi.fn(async () => {
        throw new Error("Network error");
      }),
      getSubscription: vi.fn(async () => {
        throw new Error("Network error");
      })
    });

    render(
      <SubscriptionShellProvider services={services}>
        <SubscriptionProbe />
      </SubscriptionShellProvider>
    );

    await waitFor(() => {
      const output = screen.getByTestId("sub-state");
      const state = JSON.parse(output.textContent ?? "{}");
      expect(state.status).toBe("error");
    });
  });

  it("skips API calls when feature flag is disabled", async () => {
    const services = createMockServices({ featureFlagEnabled: false });

    render(
      <SubscriptionShellProvider services={services}>
        <SubscriptionProbe />
      </SubscriptionShellProvider>
    );

    await waitFor(() => {
      const output = screen.getByTestId("sub-state");
      const state = JSON.parse(output.textContent ?? "{}");
      expect(state.status).toBe("disabled");
    });

    expect(services.fetchPlans).not.toHaveBeenCalled();
    expect(services.getSubscription).not.toHaveBeenCalled();
  });
});
