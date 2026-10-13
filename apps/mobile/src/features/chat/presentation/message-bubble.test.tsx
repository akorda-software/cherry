import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import type { TimelineMessage } from "../domain/timeline";
import { MessageBubble } from "./message-bubble";

function message(overrides: Partial<TimelineMessage> = {}): TimelineMessage {
  return {
    kind: "message",
    key: "m1",
    id: "m1",
    clientId: null,
    body: "¿Cenamos el viernes?",
    insertedAt: new Date(2026, 8, 29, 14, 5).toISOString(),
    mine: true,
    delivery: "sent",
    retryable: false,
    position: "single",
    showTime: true,
    ...overrides
  };
}

describe("MessageBubble", () => {
  it("shows the text and the time under the last bubble of a group", () => {
    renderWithTheme(<MessageBubble live={false} message={message()} onDiscard={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText("¿Cenamos el viernes?")).toBeInTheDocument();
    expect(screen.getByText("14:05")).toBeInTheDocument();
  });

  it("hides the time inside a group", () => {
    renderWithTheme(
      <MessageBubble
        live={false}
        message={message({ showTime: false, position: "middle" })}
        onDiscard={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.queryByText("14:05")).not.toBeInTheDocument();
  });

  it("says «Enviando…» while the optimistic send is in flight", () => {
    renderWithTheme(
      <MessageBubble
        live
        message={message({ id: null, clientId: "c1", key: "c1", delivery: "sending", retryable: true })}
        onDiscard={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("Enviando…")).toBeInTheDocument();
  });

  it("offers to retry a failed message", () => {
    const onRetry = vi.fn();
    renderWithTheme(
      <MessageBubble
        live
        message={message({ id: null, clientId: "c1", key: "c1", delivery: "failed", retryable: true })}
        onDiscard={vi.fn()}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByText("No se ha podido enviar · Reintentar"));
    expect(onRetry).toHaveBeenCalledWith("c1");

    fireEvent.click(screen.getByTestId("message-failed-c1"));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("does not offer a pointless retry when the conversation is closed", () => {
    const onRetry = vi.fn();
    renderWithTheme(
      <MessageBubble
        live={false}
        message={message({ id: null, clientId: "c1", key: "c1", delivery: "failed", retryable: false })}
        onDiscard={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText("No se ha podido enviar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("message-failed-c1"));
    expect(onRetry).not.toHaveBeenCalled();
  });
});
