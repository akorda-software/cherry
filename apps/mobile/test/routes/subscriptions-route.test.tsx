import { render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Plan, Subscription } from "@snack/contracts";

import { SubscriptionsRouteContent } from "../../app/(app)/subscriptions";
import { SubscriptionShellProvider } from "../../src/features/subscriptions/presentation";
import { RuntimeConfigProvider } from "../../src/shared/config";
import { ThemeProvider } from "../../src/shared/ui";
import { RouterProvider } from "../mocks/expo-router";

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

function createServices(overrides?: Record<string, unknown>) {
  return {
    featureFlagEnabled: true,
    fetchPlans: vi.fn(async () => plans),
    getSubscription: vi.fn(async () => ({ subscribed: false })),
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

function TestProviders({
  children,
  featureFlags,
  services
}: PropsWithChildren<{
  featureFlags: Record<string, boolean>;
  services: ReturnType<typeof createServices>;
}>) {
  const reader = {
    isEnabled(flagKey: string) {
      return featureFlags[flagKey] ?? false;
    }
  };

  return (
    <RouterProvider initialPath="/(app)/subscriptions">
      <ThemeProvider>
        <RuntimeConfigProvider
          apiBaseUrl="http://localhost:4000"
          bootstrapConfig={{ features: {}, services: {} }}
          reader={reader}
          loading={false}
        >
          <SubscriptionShellProvider services={services}>{children}</SubscriptionShellProvider>
        </RuntimeConfigProvider>
      </ThemeProvider>
    </RouterProvider>
  );
}

describe("SubscriptionsRoute", () => {
  it("redirects to home when the subscriptions flag is disabled", async () => {
    const services = createServices({ featureFlagEnabled: false });

    render(
      <TestProviders featureFlags={{ subscriptions: false }} services={services}>
        <SubscriptionsRouteContent />
      </TestProviders>
    );

    expect(await screen.findByText("redirect:/(app)/(tabs)/home")).toBeInTheDocument();
  });

  it("shows the plan picker when the user is unsubscribed", async () => {
    const services = createServices({
      getSubscription: vi.fn(async () => ({ subscribed: false }))
    });

    render(
      <TestProviders featureFlags={{ subscriptions: true }} services={services}>
        <SubscriptionsRouteContent />
      </TestProviders>
    );

    expect(await screen.findByText("Choose a Plan")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
  });

  it("shows the current subscription status when the user is subscribed", async () => {
    const services = createServices({
      getSubscription: vi.fn(async () => ({ subscribed: true, subscription }))
    });

    render(
      <TestProviders featureFlags={{ subscriptions: true }} services={services}>
        <SubscriptionsRouteContent />
      </TestProviders>
    );

    expect(await screen.findByText("Current Plan")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel subscription/i })).toBeInTheDocument();
    });
  });
});
