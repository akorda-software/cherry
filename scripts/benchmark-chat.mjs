import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { extname } from "node:path";
import { performance } from "node:perf_hooks";

// Run with Node >=22.18: node scripts/benchmark-chat.mjs
// Resolve the project's extensionless TS imports without changing app source or adding a runner.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !extname(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  }
});

const { mergeMessages } = await import("../apps/mobile/src/features/chat/domain/chat-messages.ts");
const { buildTimeline } = await import("../apps/mobile/src/features/chat/domain/timeline.ts");
const { previousBuildTimeline, previousMergeMessages } = await import("../apps/mobile/src/features/chat/domain/testing/hotpath-baselines.ts");

// Synthetic CPU/allocation microbenchmark, not scrolling, native rendering, networking or FPS.
const now = new Date(2026, 9, 25, 12).getTime();
const count = 2_000;
const iterations = 200;
const message = (id, time, senderProfileId = "me") => ({
  id, conversationId: "c", senderProfileId, body: id, insertedAt: new Date(time).toISOString()
});
const existing = Array.from({ length: count }, (_, i) => message(`m-${i}`, now - i * 2_000));

function measure(run) {
  for (let i = 0; i < 25; i += 1) run();
  const samples = [];
  for (let trial = 0; trial < 5; trial += 1) {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) run();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[2];
}

function operationCounts(run) {
  const NativeDate = Date;
  const nativeParse = Date.parse;
  const nativeSort = Array.prototype.sort;
  const counts = { parses: 0, dates: 0, sorts: 0, sortComparisons: 0 };
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args) { counts.dates += 1; return Reflect.construct(target, args); }
  });
  Date.parse = (...args) => { counts.parses += 1; return nativeParse(...args); };
  Array.prototype.sort = function (compare) {
    counts.sorts += 1;
    return nativeSort.call(this, compare && ((a, b) => { counts.sortComparisons += 1; return compare(a, b); }));
  };
  try { run(); } finally {
    globalThis.Date = NativeDate;
    NativeDate.parse = nativeParse;
    Array.prototype.sort = nativeSort;
  }
  return counts;
}

function report(name, before, after) {
  assert.deepEqual(after(), before(), `${name}: semantics changed`);
  const previousCounts = operationCounts(before);
  const nextCounts = operationCounts(after);
  const previousMs = measure(before);
  const nextMs = measure(after);
  console.log(`${name}: before ${previousMs.toFixed(1)} ms; after ${nextMs.toFixed(1)} ms`);
  console.log(`  operations/call before ${JSON.stringify(previousCounts)}; after ${JSON.stringify(nextCounts)}`);
}

console.log(`Node ${process.version}; TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone}; ${count} messages`);
console.log(`Median of 5 x ${iterations} calls, identical results asserted; no device/FPS claims.`);
for (const [name, incoming, tie, history = existing] of [
  ["merge live/prepend", [message("live", now + 1_000)], "newer"],
  ["merge old page/append", Array.from({ length: 50 }, (_, i) => message(`page-${i}`, now - 9_000_000 - i * 1_000)), "older"],
  ["merge interleaved", Array.from({ length: 50 }, (_, i) => message(`backfill-${i}`, now - i * 4_000 - 1_000)), "newer"],
  ["merge unordered fallback", [message("live", now + 1_000)], "newer", [...existing].reverse()],
  ["merge duplicate/no additions", [existing[0]], "newer"]
]) {
  report(name, () => previousMergeMessages(history, incoming, tie), () => mergeMessages(history, incoming, tie));
}
for (const [name, messages] of [
  ["timeline same sender", existing],
  ["timeline alternating senders", existing.map((item, i) => ({ ...item, senderProfileId: i % 2 ? "me" : "other" }))]
]) {
  const options = { isMine: (item) => item.senderProfileId === "me", now };
  report(name, () => previousBuildTimeline(messages, [], options), () => buildTimeline(messages, [], options));
}
console.log("Residual: merges still build an O(n) id Set and copy/parse O(n+k); unordered input still sorts.");
console.log("Timeline remains O(n+outbox), with one local-day key per entry; separator formatting is unchanged.");
