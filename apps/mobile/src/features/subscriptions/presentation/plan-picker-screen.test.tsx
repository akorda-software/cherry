import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Plan } from "@snack/contracts";
import { PlanPickerScreen } from "./plan-picker-screen";

const plans: Plan[] = [
  {
    id: "plan-1",
    name: "Pro Monthly",
    amountCents: 999,
    currency: "usd",
    interval: "month",
    stripePriceId: "price_monthly"
  },
  {
    id: "plan-2",
    name: "Pro Yearly",
    amountCents: 9999,
    currency: "usd",
    interval: "year",
    stripePriceId: "price_yearly"
  }
];

function createMockServices(overrides?: Record<string, unknown>) {
  return {
    plans,
    loading: false,
    error: null,
    onSubscribe: vi.fn(),
    ...overrides
  };
}

describe("PlanPickerScreen", () => {
  it("displays each plan with name, price, interval, and subscribe CTA", () => {
    const services = createMockServices();

    render(<PlanPickerScreen {...services} />);

    expect(screen.getByText("Pro Monthly")).toBeInTheDocument();
    expect(screen.getByText("$9.99/month")).toBeInTheDocument();
    expect(screen.getByText("Pro Yearly")).toBeInTheDocument();
    expect(screen.getByText("$99.99/year")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: /subscribe/i });
    expect(buttons).toHaveLength(2);
  });

  it("calls onSubscribe with the correct plan ID when CTA is clicked", () => {
    const onSubscribe = vi.fn();
    const services = createMockServices({ onSubscribe });

    render(<PlanPickerScreen {...services} />);

    const buttons = screen.getAllByRole("button", { name: /subscribe/i });
    fireEvent.click(buttons[0]);

    expect(onSubscribe).toHaveBeenCalledWith("plan-1");
  });

  it("shows a loading state while plans are being fetched", () => {
    render(<PlanPickerScreen plans={[]} loading={true} error={null} onSubscribe={vi.fn()} />);

    expect(screen.getByText("Loading plans…")).toBeInTheDocument();
  });

  it("shows an error state with retry action when fetch fails", () => {
    const onRetry = vi.fn();

    render(
      <PlanPickerScreen
        plans={[]}
        loading={false}
        error="Network error"
        onSubscribe={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText("Network error")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("disables subscribe buttons while a subscription is in progress", () => {
    const services = createMockServices({ subscribing: true });

    render(<PlanPickerScreen {...services} />);

    const buttons = screen.getAllByRole("button", { name: /subscribe/i });
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("shows an empty state when subscriptions are enabled but no plans exist", () => {
    render(<PlanPickerScreen plans={[]} loading={false} error={null} onSubscribe={vi.fn()} />);

    expect(screen.getByText("No plans available")).toBeInTheDocument();
  });
});
