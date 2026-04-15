import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader, Card, EmptyState, FormMessage, NavListItem } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("shared ui composites", () => {
  it("renders app headers and cards with generic content slots", () => {
    renderWithTheme(
      <>
        <AppHeader
          actions={<button type="button">Refresh</button>}
          subtitle="Signed-in shell"
          title="Dashboard"
        />
        <Card description="Shared cards wrap future features too." title="Starter card">
          <p>Card content</p>
        </Card>
      </>
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Dashboard");
    expect(screen.getByText("Signed-in shell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Starter card" })).toBeInTheDocument();
    expect(screen.getByText("Shared cards wrap future features too.")).toBeInTheDocument();
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("renders empty and form-message states with accessible status roles", () => {
    renderWithTheme(
      <>
        <EmptyState
          action={<button type="button">Retry</button>}
          description="Nothing is available yet."
          title="No data"
        />
        <FormMessage tone="error">Apple is unavailable</FormMessage>
        <FormMessage tone="info">Signing in with Google…</FormMessage>
      </>
    );

    expect(screen.getByRole("heading", { name: "No data" })).toBeInTheDocument();
    expect(screen.getByText("Nothing is available yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Apple is unavailable");
    expect(screen.getByRole("status")).toHaveTextContent("Signing in with Google…");
  });

  it("keeps nav list items reusable for selected and action states", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <>
        <NavListItem description="Current tab" label="Home" onPress={onPress} selected />
        <NavListItem description="Opens account view" label="User" onPress={onPress} />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "User" }));

    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Opens account view")).toBeInTheDocument();
  });
});
