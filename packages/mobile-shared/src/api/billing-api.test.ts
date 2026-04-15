import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "./auth-api";
import type { BillingPlansResponse, Plan, Subscription } from "@snack/contracts";
import { createBillingApi } from "./billing-api";

describe("createBillingApi", () => {
  function createMockHttpClient() {
    return {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn()
    } as unknown as HttpClient;
  }

  describe("fetchPlans", () => {
    it("GETs plans from the billing endpoint and returns the list", async () => {
      const http = createMockHttpClient();
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

      const response: BillingPlansResponse = { plans };

      vi.mocked(http.get).mockResolvedValueOnce(response);

      const api = createBillingApi(http);
      const result = await api.fetchPlans();

      expect(http.get).toHaveBeenCalledWith<Parameters<HttpClient["get"]>>("/api/billing/plans");
      expect(result).toEqual(plans);
    });

    it("returns an empty list when the backend has no plans", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.get).mockResolvedValueOnce({ plans: [] });

      const api = createBillingApi(http);
      const result = await api.fetchPlans();

      expect(result).toEqual([]);
    });
  });

  describe("subscribe", () => {
    it("POSTs a plan ID and receives payment sheet session data", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({
        customerId: "cus_123",
        customerEphemeralKeySecret: "ek_test_123",
        pendingSubscriptionId: "sub_pending_123",
        paymentIntentClientSecret: "pi_test_secret_123"
      });

      const api = createBillingApi(http);
      const result = await api.subscribe("plan-1");

      expect(http.post).toHaveBeenCalledWith("/api/billing/subscribe", { planId: "plan-1" });
      expect(result).toEqual({
        customerId: "cus_123",
        customerEphemeralKeySecret: "ek_test_123",
        pendingSubscriptionId: "sub_pending_123",
        paymentIntentClientSecret: "pi_test_secret_123"
      });
    });
  });

  describe("abandonPendingSubscription", () => {
    it("POSTs the pending subscription id to abandon the checkout", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({ status: "abandoned" });

      const api = createBillingApi(http);
      const result = await api.abandonPendingSubscription("sub_pending_123");

      expect(http.post).toHaveBeenCalledWith("/api/billing/abandon-pending", {
        pendingSubscriptionId: "sub_pending_123"
      });
      expect(result).toEqual({ status: "abandoned" });
    });
  });

  describe("cancel", () => {
    it("POSTs to the cancel endpoint", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({ status: "canceling" });

      const api = createBillingApi(http);
      const result = await api.cancel();

      expect(http.post).toHaveBeenCalledWith("/api/billing/cancel", undefined);
      expect(result).toEqual({ status: "canceling" });
    });
  });

  describe("getSubscription", () => {
    it("fetches the current subscription status", async () => {
      const http = createMockHttpClient();
      const subscription: Subscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        currentPeriodEnd: "2026-05-01T00:00:00Z",
        cancelAtPeriodEnd: false
      };

      vi.mocked(http.get).mockResolvedValueOnce({ subscribed: true, subscription });

      const api = createBillingApi(http);
      const result = await api.getSubscription();

      expect(http.get).toHaveBeenCalledWith("/api/billing/subscription");
      expect(result).toEqual({ subscribed: true, subscription });
    });

    it("returns unsubscribed state when user has no subscription", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.get).mockResolvedValueOnce({ subscribed: false });

      const api = createBillingApi(http);
      const result = await api.getSubscription();

      expect(result).toEqual({ subscribed: false });
    });
  });
});
