import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ThemeProvider,
  createTheme,
  lightTheme,
  primitiveBorderTokens,
  primitiveColorTokens,
  primitiveElevationTokens,
  primitiveMotionTokens,
  primitiveOpacityTokens,
  primitiveRadiusTokens,
  primitiveSizeTokens,
  primitiveSpacingTokens,
  primitiveTypographyTokens,
  useTheme
} from "../../src/shared/ui";

function ThemeProbe() {
  const theme = useTheme();

  return (
    <dl>
      <div>
        <dt>theme</dt>
        <dd>{theme.name}</dd>
      </div>
      <div>
        <dt>screen</dt>
        <dd>{theme.semantic.color.screenBackground}</dd>
      </div>
      <div>
        <dt>action</dt>
        <dd>{theme.semantic.action.primaryBackground}</dd>
      </div>
    </dl>
  );
}

describe("token and theme foundation", () => {
  it("exposes primitive catalogs and semantic role keys through the default light theme", () => {
    expect(primitiveColorTokens).toMatchObject({
      white: "#ffffff",
      slate900: expect.any(String),
      blue600: expect.any(String),
      red600: expect.any(String)
    });
    expect(primitiveSpacingTokens).toMatchObject({ xs: 4, md: 16, xl: 32 });
    expect(primitiveRadiusTokens).toMatchObject({ sm: 8, lg: 20, pill: 999 });
    expect(primitiveSizeTokens).toMatchObject({ iconMd: 20, buttonHeight: 44, contentMax: 720 });
    expect(primitiveTypographyTokens).toMatchObject({
      body: expect.objectContaining({ fontSize: 16 }),
      title: expect.objectContaining({ fontSize: 28 })
    });
    expect(primitiveBorderTokens).toMatchObject({ thin: 1, thick: 2 });
    expect(primitiveElevationTokens).toMatchObject({ raised: 6, overlay: 12 });
    expect(primitiveOpacityTokens).toMatchObject({ disabled: 0.5, muted: 0.72 });
    expect(primitiveMotionTokens).toMatchObject({ quick: 120, calm: 220 });

    expect(lightTheme.semantic.color).toMatchObject({
      screenBackground: expect.any(String),
      surfaceBackground: expect.any(String),
      surfaceElevatedBackground: expect.any(String)
    });
    expect(lightTheme.semantic.text).toMatchObject({
      default: expect.any(String),
      muted: expect.any(String),
      inverse: expect.any(String)
    });
    expect(lightTheme.semantic.icon).toMatchObject({ default: expect.any(String), accent: expect.any(String) });
    expect(lightTheme.semantic.surface).toMatchObject({ base: expect.any(String), elevated: expect.any(String) });
    expect(lightTheme.semantic.border).toMatchObject({ subtle: expect.any(String), strong: expect.any(String) });
    expect(lightTheme.semantic.action).toMatchObject({
      primaryBackground: expect.any(String),
      primaryForeground: expect.any(String),
      destructiveBackground: expect.any(String),
      disabledBackground: expect.any(String)
    });
    expect(lightTheme.semantic.state).toMatchObject({ info: expect.any(String), danger: expect.any(String) });
    expect(lightTheme.semantic.layout).toMatchObject({ contentMaxWidth: 720, touchTargetMinHeight: 44 });
  });

  it("creates swappable themes with the same semantic contract", () => {
    const duskTheme = createTheme({
      name: "dusk",
      semantic: {
        color: {
          screenBackground: "#111827"
        },
        action: {
          primaryBackground: "#8b5cf6"
        }
      }
    });

    expect(duskTheme.name).toBe("dusk");
    expect(duskTheme.semantic.color.screenBackground).toBe("#111827");
    expect(duskTheme.semantic.action.primaryBackground).toBe("#8b5cf6");
    expect(duskTheme.semantic.text.default).toBe(lightTheme.semantic.text.default);
    expect(Object.keys(duskTheme.semantic)).toEqual(Object.keys(lightTheme.semantic));
  });

  it("falls back to the default theme when no provider is mounted", () => {
    render(<ThemeProbe />);

    expect(screen.getByText(lightTheme.name)).toBeInTheDocument();
    expect(screen.getByText(lightTheme.semantic.color.screenBackground)).toBeInTheDocument();
    expect(screen.getByText(lightTheme.semantic.action.primaryBackground)).toBeInTheDocument();
  });

  it("swaps the resolved semantic values through ThemeProvider", () => {
    const duskTheme = createTheme({
      name: "dusk",
      semantic: {
        color: {
          screenBackground: "#020617"
        },
        action: {
          primaryBackground: "#f97316"
        }
      }
    });

    render(
      <ThemeProvider theme={duskTheme}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByText("dusk")).toBeInTheDocument();
    expect(screen.getByText("#020617")).toBeInTheDocument();
    expect(screen.getByText("#f97316")).toBeInTheDocument();
  });
});
