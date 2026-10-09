import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Avatar,
  Badge,
  Button,
  Divider,
  Heading,
  IconButton,
  Inline,
  Pill,
  ProgressBar,
  Screen,
  Stack,
  Surface,
  Switch,
  Text,
  UserBadge
} from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("shared ui primitives", () => {
  it("renders screen, surface, stack, inline, text, and heading content through semantic wrappers", () => {
    renderWithTheme(
      <Screen description="Reusable shell content" testId="screen-root" title="Foundation screen">
        <Surface>
          <Stack testID="stack-layout">
            <Heading>Section heading</Heading>
            <Text>Body copy</Text>
            <Inline testID="inline-layout">
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

  it("renders text with the variant font family and resolves color roles", () => {
    renderWithTheme(
      <>
        <Text variant="title1">Titular</Text>
        <Text color="muted">Secundario</Text>
      </>
    );

    expect(screen.getByText("Titular")).toHaveStyle({ fontFamily: "Rubik-Black", fontSize: "30px" });
    expect(screen.getByText("Secundario")).toHaveStyle({ fontFamily: "Rubik-Regular", color: "#5E5468" });
  });

  it("makes a pressable surface sink toward its shadow and call onPress", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Surface accessibilityLabel="Nota" onPress={onPress}>
        <Text>Púlsame</Text>
      </Surface>
    );

    fireEvent.click(screen.getByRole("button", { name: "Nota" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("communicates icon button labels, selected and disabled states", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Stack>
        <IconButton accessibilityLabel="Me gusta" color="fresa" icon="heart" onPress={onPress} selected size="xl" />
        <IconButton accessibilityLabel="Ajustes" disabled icon="gear" onPress={onPress} />
        <IconButton accessibilityLabel="Chats" badge={3} icon="chat" />
      </Stack>
    );

    fireEvent.click(screen.getByRole("button", { name: "Me gusta" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Me gusta" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ajustes" })).toBeDisabled();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("toggles the switch with switch semantics", () => {
    const onValueChange = vi.fn();

    renderWithTheme(<Switch accessibilityLabel="Avisos" onValueChange={onValueChange} value={false} />);

    const control = screen.getByRole("switch", { name: "Avisos" });
    expect(control).toHaveAttribute("aria-checked", "false");
    fireEvent.click(control);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("renders badges, pills, avatars and progress with readable labels", () => {
    renderWithTheme(
      <Stack>
        <Badge count={120} />
        <Badge count={0} testID="empty-badge" />
        <Pill icon="sparkle" label="Nuevo" />
        <Avatar name="Lucía" />
        <ProgressBar accessibilityLabel="Perfil completado" value={0.5} />
        <ProgressBar segments={6} value={3} />
      </Stack>
    );

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-badge")).not.toBeInTheDocument();
    expect(screen.getByText("Nuevo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto de Lucía" })).toHaveTextContent("L");
    expect(screen.getByRole("progressbar", { name: "Perfil completado" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Paso 3 de 6" })).toBeInTheDocument();
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
    expect(screen.getByLabelText("Pat, seleccionado")).toBeInTheDocument();
  });

  it("keeps the legacy button tone working", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Button onPress={onPress} tone="destructive">
        Delete profile
      </Button>
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Delete profile" })).toHaveAttribute("data-variant", "danger");
  });
});
