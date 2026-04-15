import type { BillingCheckoutResponse, Plan, Subscription } from "@snack/contracts";

export interface SubscriptionApiAdapter {
  fetchPlans(): Promise<Plan[]>;
  subscribe(planId: string): Promise<BillingCheckoutResponse>;
  abandonPendingSubscription(pendingSubscriptionId: string): Promise<{ status: string }>;
  cancel(): Promise<{ status: string }>;
  getSubscription(): Promise<{ subscribed: boolean; subscription?: Subscription }>;
}

interface CreateSubscriptionApiAdapterOptions {
  billingApi: {
    fetchPlans(): Promise<Plan[]>;
    subscribe(planId: string): Promise<BillingCheckoutResponse>;
    abandonPendingSubscription(pendingSubscriptionId: string): Promise<{ status: string }>;
    cancel(): Promise<{ status: string }>;
    getSubscription(): Promise<{ subscribed: boolean; subscription?: Subscription }>;
  };
}

export function createSubscriptionApiAdapter({
  billingApi
}: CreateSubscriptionApiAdapterOptions): SubscriptionApiAdapter {
  return {
    async fetchPlans() {
      return billingApi.fetchPlans();
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
    async getSubscription() {
      return billingApi.getSubscription();
    }
  };
}
