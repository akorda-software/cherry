export type SubscriptionStatus = "pending" | "active" | "canceling" | "canceled" | "past_due";

export interface Plan {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  interval: "month" | "year";
  stripePriceId: string;
}

export interface Subscription {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingPlansResponse {
  plans: Plan[];
}

export type BillingSubscriptionResponse =
  | { subscribed: false }
  | { subscribed: true; subscription: Subscription };

export interface BillingCheckoutResponse {
  customerEphemeralKeySecret: string;
  customerId: string;
  pendingSubscriptionId: string;
  paymentIntentClientSecret: string;
}

export interface BillingCancelResponse {
  status: string;
}

export interface BillingState {
  subscribed: boolean;
  subscription: Subscription | null;
  plans: Plan[];
}

export function createPlan(plan: Plan): Plan {
  return { ...plan };
}

export function createSubscription(subscription: Subscription): Subscription {
  return { ...subscription };
}

export function createBillingPlansResponse(response: BillingPlansResponse): BillingPlansResponse {
  return {
    plans: response.plans.map(createPlan)
  };
}

export function createBillingSubscriptionResponse(
  response: BillingSubscriptionResponse
): BillingSubscriptionResponse {
  if (!response.subscribed) {
    return { subscribed: false };
  }

  return {
    subscribed: true,
    subscription: createSubscription(response.subscription)
  };
}
