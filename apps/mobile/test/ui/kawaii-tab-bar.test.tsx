import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KawaiiTabBar, tabBarSpace, TAB_BAR_HEIGHT, useTabBadgesStore } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

function makeProps(index: number, badges: Record<string, number | undefined> = {}) {
  const names = ["discover", "likes", "chats", "me"];
  const labels = ["Descubrir", "Likes", "Chats", "Yo"];
  const routes = names.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const descriptors = Object.fromEntries(
    routes.map((route, i) => [
      route.key,
      {
        options: {
          title: labels[i],
          tabBarBadge: badges[route.name],
          tabBarButtonTestID: `tab-${route.name}`,
          tabBarIcon: () => <span>{`icon-${route.name}`}</span>
        }
      }
    ])
  );
  const navigation = {
    emit: vi.fn(() => ({ defaultPrevented: false })),
    navigate: vi.fn()
  };

  return {
    props: {
      state: { index, routes },
      descriptors,
      navigation,
      insets: { top: 0, right: 0, bottom: 34, left: 0 }
    } as unknown as BottomTabBarProps,
    navigation
  };
}

describe("KawaiiTabBar", () => {
  it("renders the four tabs with the active one selected and badges announced", () => {
    const { props } = makeProps(0, { likes: 3, chats: 1 });

    renderWithTheme(<KawaiiTabBar {...props} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByTestId("tab-discover")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("tab-likes")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Likes, 3 nuevos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chats, 1 nuevo" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Descubrir")).toBeInTheDocument();
  });

  it("navigates to inactive tabs and ignores presses on the active one", () => {
    const { props, navigation } = makeProps(0);

    renderWithTheme(<KawaiiTabBar {...props} />);

    fireEvent.click(screen.getByTestId("tab-chats"));
    expect(navigation.emit).toHaveBeenCalledWith({ type: "tabPress", target: "chats-key", canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith("chats", undefined);

    navigation.navigate.mockClear();
    fireEvent.click(screen.getByTestId("tab-discover"));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("keeps badge counts in a shared store and reserves space above the safe area", () => {
    act(() => useTabBadgesStore.getState().set({ likes: 5 }));
    expect(useTabBadgesStore.getState()).toMatchObject({ likes: 5, chats: 0 });
    act(() => useTabBadgesStore.getState().set({ chats: 2, likes: 0 }));
    expect(useTabBadgesStore.getState()).toMatchObject({ likes: 0, chats: 2 });

    expect(tabBarSpace(34)).toBe(TAB_BAR_HEIGHT + 34);
    expect(tabBarSpace(0)).toBe(TAB_BAR_HEIGHT + 12);
  });
});
