import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Paywall } from "./paywall";

describe("Paywall", () => {
  it("renders children when the feature flag is disabled", () => {
    render(
      <Paywall featureFlagEnabled={false} subscribed={true}>
        <p>Gated content</p>
      </Paywall>
    );

    expect(screen.getByText("Gated content")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
  });

  it("renders children when the feature flag is enabled and user is subscribed", () => {
    render(
      <Paywall featureFlagEnabled={true} subscribed={true}>
        <p>Gated content</p>
      </Paywall>
    );

    expect(screen.getByText("Gated content")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
  });

  it("shows paywall CTA when flag is enabled but user is unsubscribed", () => {
    render(
      <Paywall featureFlagEnabled={true} subscribed={false}>
        <p>Gated content</p>
      </Paywall>
    );

    expect(screen.queryByText("Gated content")).not.toBeInTheDocument();
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
    expect(screen.getByText("Subscribe to access this feature")).toBeInTheDocument();
  });

  it("shows a subscribe button in the paywall CTA", () => {
    const onSubscribe = vi.fn();

    render(
      <Paywall featureFlagEnabled={true} subscribed={false} onSubscribe={onSubscribe}>
        <p>Gated content</p>
      </Paywall>
    );

    const button = screen.getByRole("button", { name: /subscribe/i });
    expect(button).toBeInTheDocument();
  });
});
