import { describe, expect, it, vi } from "vitest";

import type { Subscription } from "@snack/contracts";
import { createSubscriptionApiAdapter } from "./subscription-api";

function stubBillingApi(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    fetchPlans: vi.fn(async () => []),
    subscribe: vi.fn(async () => ({
      customerId: "cus_123",
      customerEphemeralKeySecret: "ek_test_123",
      pendingSubscriptionId: "sub_pending_123",
      paymentIntentClientSecret: "pi_test_secret_123"
    })),
    abandonPendingSubscription: vi.fn(async () => ({ status: "abandoned" })),
    cancel: vi.fn(async () => ({ status: "" })),
    getSubscription: vi.fn(async () => ({ subscribed: false })),
    ...overrides
  };
}

describe("createSubscriptionApiAdapter", () => {
  describe("fetchPlans", () => {
    it("maps raw API response plans to domain Plan type", async () => {
      const billingApi = stubBillingApi({
        fetchPlans: vi.fn(async () => [
          {
            id: "plan-1",
            name: "Pro",
            amountCents: 999,
            currency: "usd",
            interval: "month",
            stripePriceId: "price_abc"
          }
        ])
      });

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const plans = await adapter.fetchPlans();

      expect(plans).toEqual([
        {
          id: "plan-1",
          name: "Pro",
          amountCents: 999,
          currency: "usd",
          interval: "month",
          stripePriceId: "price_abc"
        }
      ]);
    });

    it("returns empty array when API returns no plans", async () => {
      const billingApi = stubBillingApi({
        fetchPlans: vi.fn(async () => [])
      });

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const plans = await adapter.fetchPlans();

      expect(plans).toEqual([]);
    });
  });

  describe("subscribe", () => {
    it("returns payment sheet session data", async () => {
      const billingApi = stubBillingApi({
        subscribe: vi.fn(async () => ({
          customerId: "cus_123",
          customerEphemeralKeySecret: "ek_test_123",
          pendingSubscriptionId: "sub_pending_123",
          paymentIntentClientSecret: "pi_test_secret_123"
        }))
      });

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const result = await adapter.subscribe("plan-1");

      expect(result).toEqual({
        customerId: "cus_123",
        customerEphemeralKeySecret: "ek_test_123",
        pendingSubscriptionId: "sub_pending_123",
        paymentIntentClientSecret: "pi_test_secret_123"
      });
      expect(billingApi.subscribe).toHaveBeenCalledWith("plan-1");
    });
  });

  describe("abandonPendingSubscription", () => {
    it("forwards the pending subscription abandonment to the API", async () => {
      const billingApi = stubBillingApi();

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const result = await adapter.abandonPendingSubscription("sub_pending_123");

      expect(result).toEqual({ status: "abandoned" });
      expect(billingApi.abandonPendingSubscription).toHaveBeenCalledWith("sub_pending_123");
    });
  });

  describe("cancel", () => {
    it("returns the cancel status from the API", async () => {
      const billingApi = stubBillingApi({
        cancel: vi.fn(async () => ({ status: "canceling" }))
      });

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const result = await adapter.cancel();

      expect(result).toEqual({ status: "canceling" });
    });
  });

  describe("getSubscription", () => {
    it("maps subscribed response with subscription data", async () => {
      const subscription: Subscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        currentPeriodEnd: "2026-05-01T00:00:00Z",
        cancelAtPeriodEnd: false
      };

      const billingApi = stubBillingApi({
        getSubscription: vi.fn(async () => ({
          subscribed: true,
          subscription
        }))
      });

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const result = await adapter.getSubscription();

      expect(result).toEqual({ subscribed: true, subscription });
    });

    it("maps unsubscribed response with no subscription", async () => {
      const billingApi = stubBillingApi({
        getSubscription: vi.fn(async () => ({ subscribed: false }))
      });

      const adapter = createSubscriptionApiAdapter({ billingApi });
      const result = await adapter.getSubscription();

      expect(result).toEqual({ subscribed: false });
    });
  });
});
