import { performance } from "node:perf_hooks";
import { lastActivityAt, sortMatchesByActivity } from "../apps/mobile/src/features/matches/domain/match-list.ts";

// Synthetic JS sorting only. This does not measure scrolling, rendering or device FPS.
const count = 2_000;
const entries = Array.from({ length: count }, (_, index) => ({
  id: `match-${index}`,
  matchedAt: new Date(Date.UTC(2026, 9, 1) + (index % 100) * 1_000).toISOString(),
  lastMessage: index % 4 === 0 ? null : {
    insertedAt: new Date(Date.UTC(2026, 9, 2) + ((index * 7919) % count) * 1_000).toISOString()
  }
}));
const previousSort = (matches) => [...matches].sort((a, b) => lastActivityAt(b) - lastActivityAt(a));
const ids = (matches) => matches.map((entry) => entry.id).join(",");
if (ids(previousSort(entries)) !== ids(sortMatchesByActivity(entries))) throw new Error("Ordering changed");

function measure(sort) {
  for (let i = 0; i < 10; i += 1) sort(entries);
  const start = performance.now();
  for (let i = 0; i < 100; i += 1) sort(entries);
  return performance.now() - start;
}

function parseCount(sort) {
  const original = Date.parse;
  let calls = 0;
  Date.parse = (...args) => { calls += 1; return original(...args); };
  try { sort(entries); } finally { Date.parse = original; }
  return calls;
}

console.log(`${count} synthetic matches, identical ordering, 100 sorts (Node microbenchmark)`);
console.log(`Before: ${measure(previousSort).toFixed(1)} ms; ${parseCount(previousSort)} timestamp parses per sort`);
console.log(`After: ${measure(sortMatchesByActivity).toFixed(1)} ms; ${parseCount(sortMatchesByActivity)} timestamp parses per sort`);
