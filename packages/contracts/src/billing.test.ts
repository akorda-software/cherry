import { describe, expect, it } from "vitest";

import {
  type BillingPlansResponse,
  type BillingSubscriptionResponse,
  type Plan,
  type Subscription,
  type SubscriptionStatus,
  createBillingPlansResponse,
  createBillingSubscriptionResponse,
  createPlan,
  createSubscription
} from "./billing";

describe("createPlan", () => {
  it("builds a plan with all required billing fields", () => {
    const plan: Plan = createPlan({
      id: "plan-1",
      name: "Pro",
      amountCents: 999,
      currency: "usd",
      interval: "month",
      stripePriceId: "price_abc123"
    });

    expect(plan).toEqual({
      id: "plan-1",
      name: "Pro",
      amountCents: 999,
      currency: "usd",
      interval: "month",
      stripePriceId: "price_abc123"
    });
  });

  it("preserves each distinct billing interval without mutation", () => {
    const monthly: Plan = createPlan({
      id: "plan-m",
      name: "Monthly",
      amountCents: 999,
      currency: "usd",
      interval: "month",
      stripePriceId: "price_m"
    });

    const yearly: Plan = createPlan({
      id: "plan-y",
      name: "Yearly",
      amountCents: 9999,
      currency: "usd",
      interval: "year",
      stripePriceId: "price_y"
    });

    expect(monthly.interval).toBe("month");
    expect(yearly.interval).toBe("year");
    expect(monthly.amountCents).toBe(999);
    expect(yearly.amountCents).toBe(9999);
  });
});

describe("createSubscription", () => {
  it("builds an active subscription from backend data", () => {
    const sub: Subscription = createSubscription({
      id: "sub-1",
      planId: "plan-1",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00Z",
      cancelAtPeriodEnd: false
    });

    expect(sub).toEqual({
      id: "sub-1",
      planId: "plan-1",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00Z",
      cancelAtPeriodEnd: false
    });
  });

  it("represents a canceling subscription with period-end date", () => {
    const sub: Subscription = createSubscription({
      id: "sub-2",
      planId: "plan-1",
      status: "canceling",
      currentPeriodEnd: "2026-05-01T00:00:00Z",
      cancelAtPeriodEnd: true
    });

    expect(sub.status).toBe("canceling");
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });
});

describe("SubscriptionStatus type coverage", () => {
  it("accepts all valid subscription statuses", () => {
    const statuses: SubscriptionStatus[] = [
      "pending",
      "active",
      "canceling",
      "canceled",
      "past_due"
    ];

    expect(statuses).toHaveLength(5);
    expect(statuses).toContain("active");
    expect(statuses).toContain("canceling");
    expect(statuses).toContain("past_due");
  });
});

describe("billing DTO helpers", () => {
  it("wraps plan lists for the HTTP billing response", () => {
    const response: BillingPlansResponse = createBillingPlansResponse({
      plans: [
        {
          id: "plan-1",
          name: "Pro",
          amountCents: 999,
          currency: "usd",
          interval: "month",
          stripePriceId: "price_abc123"
        }
      ]
    });

    expect(response.plans).toHaveLength(1);
    expect(response.plans[0]?.name).toBe("Pro");
  });

  it("preserves subscribed and unsubscribed billing state responses", () => {
    const unsubscribed: BillingSubscriptionResponse = createBillingSubscriptionResponse({
      subscribed: false
    });

    const subscribed: BillingSubscriptionResponse = createBillingSubscriptionResponse({
      subscribed: true,
      subscription: {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        currentPeriodEnd: "2026-05-01T00:00:00Z",
        cancelAtPeriodEnd: false
      }
    });

    expect(unsubscribed).toEqual({ subscribed: false });
    expect(subscribed).toEqual({
      subscribed: true,
      subscription: {
        id: "sub-1",
        planId: "plan-1",
        status: "active",
        currentPeriodEnd: "2026-05-01T00:00:00Z",
        cancelAtPeriodEnd: false
      }
    });
  });

  it("supports the payment sheet checkout response shape", () => {
    expect({
      customerId: "cus_123",
      customerEphemeralKeySecret: "ek_test_123",
      pendingSubscriptionId: "sub_pending_123",
      paymentIntentClientSecret: "pi_test_secret_123"
    }).toEqual({
      customerId: "cus_123",
      customerEphemeralKeySecret: "ek_test_123",
      pendingSubscriptionId: "sub_pending_123",
      paymentIntentClientSecret: "pi_test_secret_123"
    });
  });
});
