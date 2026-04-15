import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Button,
  Divider,
  Heading,
  IconButton,
  Inline,
  Screen,
  Stack,
  Surface,
  Text,
  UserBadge
} from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("shared ui primitives", () => {
  it("renders screen, surface, stack, inline, text, and heading content through semantic wrappers", () => {
    renderWithTheme(
      <Screen description="Reusable shell content" testId="screen-root" title="Foundation screen">
        <Surface>
          <Stack data-testid="stack-layout">
            <Heading>Section heading</Heading>
            <Text>Body copy</Text>
            <Inline data-testid="inline-layout">
              <Text>Inline one</Text>
              <Text>Inline two</Text>
            </Inline>
          </Stack>
        </Surface>
      </Screen>
    );

    expect(screen.getByTestId("screen-root")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Foundation screen" })).toBeInTheDocument();
    expect(screen.getByText("Reusable shell content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Section heading" })).toBeInTheDocument();
    expect(screen.getByText("Body copy")).toBeInTheDocument();
    expect(screen.getByTestId("stack-layout")).toBeInTheDocument();
    expect(screen.getByTestId("inline-layout")).toBeInTheDocument();
  });

  it("keeps button variants accessible for default, disabled, and destructive states", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Stack>
        <Button onPress={onPress}>Continue</Button>
        <Button disabled onPress={onPress}>
          Waiting
        </Button>
        <Button onPress={onPress} tone="destructive">
          Delete profile
        </Button>
      </Stack>
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete profile" }));

    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Waiting" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete profile" })).toHaveAttribute("data-tone", "destructive");
  });

  it("communicates icon button selected and disabled states consistently", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Stack>
        <IconButton icon="⌂" label="Go home" onPress={onPress} selected />
        <IconButton disabled icon="⚙" label="Open settings" onPress={onPress} />
      </Stack>
    );

    fireEvent.click(screen.getByRole("button", { name: "Go home" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Go home" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Open settings" })).toBeDisabled();
  });

  it("renders divider and user badges with readable default and selected states", () => {
    renderWithTheme(
      <Stack>
        <Divider label="Profile section" />
        <UserBadge email="sam@example.com" name="Sam" />
        <UserBadge email="pat@example.com" name="Pat" selected />
      </Stack>
    );

    expect(screen.getByRole("separator", { name: "Profile section" })).toBeInTheDocument();
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Pat, selected user badge")).toBeInTheDocument();
  });
});
