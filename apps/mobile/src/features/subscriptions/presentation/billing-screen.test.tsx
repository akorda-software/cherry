import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Subscription } from "@snack/contracts";

import { BillingScreen } from "./billing-screen";

const subscription: Subscription = {
  id: "sub-1",
  planId: "plan-1",
  status: "active",
  currentPeriodEnd: "2026-05-01T00:00:00Z",
  cancelAtPeriodEnd: false
};

describe("BillingScreen", () => {
  it("shows the active plan and cancel CTA", () => {
    const onCancel = vi.fn();

    render(<BillingScreen subscription={subscription} planName="Pro" onCancel={onCancel} />);

    expect(screen.getByText("Current Plan")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows period-end messaging when the subscription is already canceling", () => {
    render(
      <BillingScreen
        subscription={{ ...subscription, status: "canceling", cancelAtPeriodEnd: true }}
        planName="Pro"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/your subscription will remain active until/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel subscription/i })
    ).not.toBeInTheDocument();
  });

  it("shows a fallback billing message when Stripe has not returned a period end yet", () => {
    render(
      <BillingScreen
        subscription={{ ...subscription, status: "pending", currentPeriodEnd: null }}
        planName="Pro"
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByText("Billing schedule will update after Stripe confirms the current cycle.")
    ).toBeInTheDocument();
  });
});
