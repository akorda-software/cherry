import type {
  BillingCancelResponse,
  BillingCheckoutResponse,
  BillingPlansResponse,
  BillingSubscriptionResponse,
  Plan
} from "@snack/contracts";

import type { HttpClient } from "./auth-api";

export interface BillingApi {
  fetchPlans(): Promise<Plan[]>;
  subscribe(planId: string): Promise<BillingCheckoutResponse>;
  abandonPendingSubscription(pendingSubscriptionId: string): Promise<{ status: string }>;
  cancel(): Promise<BillingCancelResponse>;
  getSubscription(): Promise<BillingSubscriptionResponse>;
}

export function createBillingApi(httpClient: HttpClient): BillingApi {
  return {
    async fetchPlans() {
      const response = await httpClient.get<BillingPlansResponse>("/api/billing/plans");
      return response.plans;
    },
    subscribe(planId) {
      return httpClient.post("/api/billing/subscribe", { planId });
    },
    abandonPendingSubscription(pendingSubscriptionId) {
      return httpClient.post("/api/billing/abandon-pending", { pendingSubscriptionId });
    },
    cancel() {
      return httpClient.post("/api/billing/cancel", undefined);
    },
    getSubscription() {
      return httpClient.get("/api/billing/subscription");
    }
  };
}
