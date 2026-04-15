import type { BillingCheckoutResponse, Plan } from "@snack/contracts";

import type { BillingApi } from "@snack/mobile-shared";

export interface SubscriptionUseCases {
  fetchPlans(): Promise<Plan[]>;
  subscribe(planId: string): Promise<BillingCheckoutResponse>;
  abandonPendingSubscription(pendingSubscriptionId: string): Promise<{ status: string }>;
  cancel(): Promise<{ status: string }>;
  checkAccess(): Promise<{ subscribed: boolean; subscription?: unknown }>;
}

interface CreateSubscriptionUseCasesOptions {
  billingApi: BillingApi;
}

export function createSubscriptionUseCases({
  billingApi
}: CreateSubscriptionUseCasesOptions): SubscriptionUseCases {
  return {
    async fetchPlans() {
      return billingApi.fetchPlans() as Promise<Plan[]>;
    },

    async subscribe(planId) {
      return billingApi.subscribe(planId);
    },

    async abandonPendingSubscription(pendingSubscriptionId) {
      return billingApi.abandonPendingSubscription(pendingSubscriptionId);
    },

    async cancel() {
      return billingApi.cancel();
    },

    async checkAccess() {
      return billingApi.getSubscription();
    }
  };
}
