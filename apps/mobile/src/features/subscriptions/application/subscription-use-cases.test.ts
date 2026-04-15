import { describe, expect, it, vi } from "vitest";

import type { Plan, Subscription } from "@snack/contracts";
import { createSubscriptionUseCases } from "./subscription-use-cases";

function createMockBillingApi() {
  return {
    fetchPlans: vi.fn<() => Promise<Plan[]>>(),
    subscribe: vi.fn<
      (planId: string) =>
        Promise<{
          customerId: string;
          customerEphemeralKeySecret: string;
          pendingSubscriptionId: string;
          paymentIntentClientSecret: string;
        }>
    >(),
    abandonPendingSubscription: vi.fn<(pendingSubscriptionId: string) => Promise<{ status: string }>>(),
    cancel: vi.fn<() => Promise<{ status: string }>>(),
    getSubscription: vi.fn<() => Promise<{ subscribed: boolean; subscription?: Subscription }>>()
  };
}

describe("createSubscriptionUseCases", () => {
  describe("fetchPlans", () => {
    it("returns plans from the billing API", async () => {
      const api = createMockBillingApi();
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

      vi.mocked(api.fetchPlans).mockResolvedValueOnce(plans);

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.fetchPlans();

      expect(result).toEqual(plans);
      expect(api.fetchPlans).toHaveBeenCalledOnce();
    });

    it("returns an empty array when the API returns no plans", async () => {
      const api = createMockBillingApi();
      vi.mocked(api.fetchPlans).mockResolvedValueOnce([]);

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.fetchPlans();

      expect(result).toEqual([]);
    });
  });

  describe("subscribe", () => {
    it("creates a payment sheet session for the given plan", async () => {
      const api = createMockBillingApi();
      vi.mocked(api.subscribe).mockResolvedValueOnce({
        customerId: "cus_123",
        customerEphemeralKeySecret: "ek_test_123",
        pendingSubscriptionId: "sub_pending_123",
        paymentIntentClientSecret: "pi_test_secret_123"
      });

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.subscribe("plan-1");

      expect(result).toEqual({
        customerId: "cus_123",
        customerEphemeralKeySecret: "ek_test_123",
        pendingSubscriptionId: "sub_pending_123",
        paymentIntentClientSecret: "pi_test_secret_123"
      });
      expect(api.subscribe).toHaveBeenCalledWith("plan-1");
    });
  });

  describe("abandonPendingSubscription", () => {
    it("abandons the pending checkout when requested", async () => {
      const api = createMockBillingApi();
      vi.mocked(api.abandonPendingSubscription).mockResolvedValueOnce({ status: "abandoned" });

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.abandonPendingSubscription("sub_pending_123");

      expect(result).toEqual({ status: "abandoned" });
      expect(api.abandonPendingSubscription).toHaveBeenCalledWith("sub_pending_123");
    });
  });

  describe("cancel", () => {
    it("calls the cancel endpoint and returns the result", async () => {
      const api = createMockBillingApi();
      vi.mocked(api.cancel).mockResolvedValueOnce({ status: "canceling" });

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.cancel();

      expect(result).toEqual({ status: "canceling" });
      expect(api.cancel).toHaveBeenCalledOnce();
    });
  });

  describe("checkAccess", () => {
    it("returns subscribed state from the API", async () => {
      const api = createMockBillingApi();
      const subscription: Subscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        currentPeriodEnd: "2026-05-01T00:00:00Z",
        cancelAtPeriodEnd: false
      };

      vi.mocked(api.getSubscription).mockResolvedValueOnce({ subscribed: true, subscription });

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.checkAccess();

      expect(result).toEqual({ subscribed: true, subscription });
    });

    it("returns unsubscribed when the user has no subscription", async () => {
      const api = createMockBillingApi();
      vi.mocked(api.getSubscription).mockResolvedValueOnce({ subscribed: false });

      const useCases = createSubscriptionUseCases({ billingApi: api });
      const result = await useCases.checkAccess();

      expect(result).toEqual({ subscribed: false });
    });
  });
});
