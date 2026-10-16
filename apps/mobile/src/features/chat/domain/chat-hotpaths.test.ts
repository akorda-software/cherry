import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@cherry/contracts";

import { mergeMessages, sortNewestFirst, type OutgoingMessage } from "./chat-messages";
import { buildTimeline, GROUP_WINDOW_MS } from "./timeline";
import * as timeFormat from "./time-format";
import { previousBuildTimeline, previousMergeMessages } from "./testing/hotpath-baselines";

const NOW = new Date(2026, 9, 25, 12).getTime();
const isMine = (message: ChatMessage) => message.senderProfileId === "me";

function message(id: string, insertedAt: string, senderProfileId = "me"): ChatMessage {
  return { id, insertedAt, senderProfileId, conversationId: "conversation", body: `body-${id}` };
}

function outgoing(id: string, createdAt: string, failed = false): OutgoingMessage {
  return {
    clientId: id, conversationId: "conversation", body: id, createdAt,
    status: failed ? "failed" : "sending", attempts: 1, ambiguous: failed, retryable: !failed
  };
}

function randomFromSeed(seed: number): (max: number) => number {
  return (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
}

const dates = [
  "", "invalid", "1970-01-01T00:00:00Z", "1969-12-31T23:59:59Z",
  "2026-10-25T02:00:00+02:00", "2026-10-25T02:00:00+01:00", // repeated local hour (Madrid DST)
  "2026-03-29T01:59:59+01:00", "2026-03-29T03:00:00+02:00", // skipped local hour
  "2026-11-01T01:30:00-04:00", "2026-11-01T01:30:00-05:00", // New York DST
  "2026-10-24T23:59:59.999Z", "2026-10-25T00:00:00Z", "2026-10-25T00:00:00.001Z",
  "2025-12-31T23:59:59Z", "2027-01-01T00:00:00Z"
];

afterEach(() => vi.restoreAllMocks());

function expectSameMerge(existing: readonly ChatMessage[], incoming: readonly ChatMessage[]): void {
  for (const tie of ["newer", "older"] as const) {
    const expected = previousMergeMessages(existing, incoming, tie);
    const actual = mergeMessages(existing, incoming, tie);
    expect(actual).toEqual(expected);
    actual.messages.forEach((item, index) => expect(item).toBe(expected.messages[index]));
    actual.added.forEach((item, index) => expect(item).toBe(expected.added[index]));
    if (expected.added.length === 0) expect(actual.messages).toBe(existing);
  }
}

describe("mergeMessages differential baseline", () => {
  it("preserves stable ties, first id wins, invalid dates, pre-epoch times and frozen inputs", () => {
    const existing = Object.freeze([
      Object.freeze(message("known", "invalid")),
      Object.freeze(message("duplicate-existing", dates[2]!)),
      Object.freeze(message("duplicate-existing", dates[2]!)),
      Object.freeze(message("negative", dates[3]!))
    ]);
    const incoming = Object.freeze([
      Object.freeze({ ...message("known", dates[12]!), body: "must not replace" }),
      Object.freeze(message("new-invalid", "")),
      Object.freeze(message("new-epoch", dates[2]!)),
      Object.freeze({ ...message("new-invalid", dates[12]!), body: "must not replace first incoming" })
    ]);
    expectSameMerge(existing, incoming);
    expectSameMerge(existing, []);
    expectSameMerge([], incoming);
    expectSameMerge(existing, [incoming[0]!]);
    expectSameMerge([...existing].reverse(), incoming);
  });

  it("preserves ties within and between both sorted inputs during an interleaved merge", () => {
    const existing = Object.freeze([
      message("known-late", "2026-10-25T10:00:06Z"),
      message("known-tie-1", "2026-10-25T10:00:05Z"),
      message("known-tie-2", "2026-10-25T11:00:05.000+01:00"),
      message("known-early", "2026-10-25T10:00:03Z"),
      message("known-invalid", "invalid"),
      message("known-negative", dates[3]!)
    ].map((item) => Object.freeze(item)));
    const incoming = Object.freeze([
      message("new-late", "2026-10-25T10:00:07Z"),
      message("new-precision", "2026-10-25T10:00:05.500Z"),
      message("new-tie-1", "2026-10-25T10:00:05Z"),
      message("new-tie-2", "2026-10-25T10:00:05.000Z"),
      message("new-early", "2026-10-25T10:00:04Z"),
      message("new-epoch", dates[2]!),
      message("new-negative", dates[3]!)
    ].map((item) => Object.freeze(item)));
    expectSameMerge(existing, incoming);
    expect(mergeMessages(existing, incoming).added).toEqual(incoming);
  });

  it("matches the old algorithm for 1,000 seeded ordered and arbitrary input pairs", () => {
    const random = randomFromSeed(0xc4e229);
    for (let run = 0; run < 1_000; run += 1) {
      const make = (length: number, source: string) => Array.from({ length }, (_, index) => ({
        ...message(`id-${random(45)}`, dates[random(dates.length)]!), body: `${source}-${index}`
      }));
      let existing = make(random(45), "existing");
      let incoming = make(random(25), "incoming");
      if (run % 3 !== 0) existing = sortNewestFirst(existing);
      if (run % 3 === 1) incoming = sortNewestFirst(incoming);
      existing.forEach(Object.freeze);
      incoming.forEach(Object.freeze);
      expectSameMerge(Object.freeze(existing), Object.freeze(incoming));
    }
  });

  it("uses no sort for ordered prepend, append or interleaved inputs, parsing each retained timestamp once", () => {
    const existing = Array.from({ length: 2_000 }, (_, i) => message(`old-${i}`, new Date(NOW - i * 2_000).toISOString()));
    const cases = [
      [message("newest", new Date(NOW + 1_000).toISOString())],
      [message("oldest", new Date(NOW - 9_000_000).toISOString())],
      [message("middle", new Date(NOW - 3_000).toISOString()), message("middle-2", new Date(NOW - 7_000).toISOString())]
    ];
    const parse = vi.spyOn(Date, "parse");
    const sort = vi.spyOn(Array.prototype, "sort");
    for (const incoming of cases) {
      for (const tie of ["newer", "older"] as const) {
        parse.mockClear();
        sort.mockClear();
        const result = mergeMessages(existing, incoming, tie);
        expect(parse).toHaveBeenCalledTimes(existing.length + incoming.length);
        expect(sort).not.toHaveBeenCalled();
        expect(result.messages).toHaveLength(existing.length + incoming.length);
      }
    }
    parse.mockClear();
    expect(mergeMessages(existing, [existing[0]!]).messages).toBe(existing);
    expect(mergeMessages(existing, []).messages).toBe(existing);
    expect(parse).not.toHaveBeenCalled();
  });

  it("retains the unordered fallback without parsing twice or sorting added in place", () => {
    const existing = [message("early", dates[3]!), message("late", dates[12]!)];
    const incoming = [message("a", dates[4]!), message("b", dates[5]!), message("a", "invalid")];
    const parse = vi.spyOn(Date, "parse");
    const sort = vi.spyOn(Array.prototype, "sort");
    const result = mergeMessages(existing, incoming);
    expect(parse).toHaveBeenCalledTimes(4);
    expect(sort).toHaveBeenCalledTimes(1);
    expect(result.added).toEqual(incoming.slice(0, 2));
  });
});

describe("buildTimeline differential baseline", () => {
  it("keeps fallback-to-now, aliases, day/year labels, timezone transitions and the exact grouping boundary", () => {
    const messages = [
      message("invalid", "invalid"), message("now", new Date(NOW).toISOString()),
      message("boundary", new Date(NOW - GROUP_WINDOW_MS).toISOString()),
      message("outside", new Date(NOW - 2 * GROUP_WINDOW_MS - 1).toISOString()),
      ...dates.map((date, i) => message(`date-${i}`, date, i % 3 ? "me" : "other"))
    ].map((item) => Object.freeze(item));
    const outbox = Object.freeze([
      Object.freeze(outgoing("invalid-send", "")),
      Object.freeze(outgoing("future-failed", new Date(NOW + GROUP_WINDOW_MS).toISOString(), true))
    ]);
    for (const now of [NOW, NaN, 0]) {
      const options = { isMine, now, keyAliases: new Map([["now", "client-now"], ["date-1", "client-invalid"]]) };
      expect(buildTimeline(Object.freeze(messages), outbox, options)).toEqual(previousBuildTimeline(messages, outbox, options));
    }
  });

  it("matches every row of the old algorithm for 500 seeded histories and outboxes, including unordered inputs", () => {
    const random = randomFromSeed(0x25da7e);
    for (let run = 0; run < 500; run += 1) {
      const messages = Array.from({ length: random(55) }, (_, i) => message(
        `m-${i}`, random(3) === 0 ? dates[random(dates.length)]! : new Date(NOW - random(200) * 60_000).toISOString(),
        random(2) ? "me" : "other"
      ));
      if (run % 2) messages.sort((a, b) => Date.parse(b.insertedAt) - Date.parse(a.insertedAt));
      const outbox = Array.from({ length: random(8) }, (_, i) => outgoing(`client-${i}`, dates[random(dates.length)]!, Boolean(random(2))));
      const keyAliases = new Map(messages.filter(() => random(3) === 0).map((item) => [item.id, `client-${item.id}`]));
      const options = { isMine, now: NOW, keyAliases };
      messages.forEach(Object.freeze);
      outbox.forEach(Object.freeze);
      expect(buildTimeline(Object.freeze(messages), Object.freeze(outbox), options)).toEqual(previousBuildTimeline(messages, outbox, options));
    }
  });

  it("computes one local day per entry instead of recomputing both neighbors' days", () => {
    const messages = Array.from({ length: 1_000 }, (_, i) => message(`m-${i}`, new Date(NOW - i * 1_000).toISOString()));
    const outbox = [outgoing("pending", new Date(NOW + 1_000).toISOString())];
    const localDay = vi.spyOn(timeFormat, "localDayKey");
    previousBuildTimeline(messages, outbox, { isMine, now: NOW });
    expect(localDay).toHaveBeenCalledTimes(6 * (messages.length + outbox.length) - 5);
    localDay.mockClear();
    const parse = vi.spyOn(Date, "parse");
    buildTimeline(messages, outbox, { isMine, now: NOW });
    expect(localDay).toHaveBeenCalledTimes(messages.length + outbox.length);
    expect(parse).toHaveBeenCalledTimes(messages.length + outbox.length);
  });
});
