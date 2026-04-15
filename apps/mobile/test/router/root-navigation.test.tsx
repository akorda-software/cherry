import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IndexRoute from "../../app/index";
import { PrivateLayout } from "../../app/(app)/_layout";
import { renderRoute } from "./render-route";
import { sessionFixture } from "./session-shell.fixture";

describe("root navigation", () => {
  it("redirects signed-out users from index to the public login route", async () => {
    renderRoute(<IndexRoute />);

    expect(await screen.findByText("redirect:/(public)/login")).toBeInTheDocument();
  });

  it("redirects signed-in users from index to the canonical home tab", async () => {
    renderRoute(<IndexRoute />, {
      services: {
        bootstrapSession: {
          execute: async () => sessionFixture
        }
      }
    });

    expect(await screen.findByText("redirect:/(app)/(tabs)/home")).toBeInTheDocument();
  });

  it("blocks private routes when there is no authenticated session", async () => {
    renderRoute(
      <PrivateLayout>
        <div>private content</div>
      </PrivateLayout>
    );

    expect(await screen.findByText("redirect:/(public)/login")).toBeInTheDocument();
    expect(screen.queryByText("private content")).not.toBeInTheDocument();
  });
});
