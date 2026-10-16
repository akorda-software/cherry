import { performance } from "node:perf_hooks";
import { graphemeCount } from "../apps/mobile/src/features/onboarding/domain/profile-fields.ts";

// Microbenchmark only: Node's Intl implementation is not a native-device FPS measurement.
const segmenter = new Intl.Segmenter("es", { granularity: "grapheme" });
function previousCount(value) {
  let count = 0;
  for (const _segment of segmenter.segment(value)) count += 1;
  return count;
}

function measure(count, value) {
  for (let i = 0; i < 1_000; i += 1) count(value);
  let checksum = 0;
  const start = performance.now();
  for (let i = 0; i < 20_000; i += 1) checksum += count(value);
  return { ms: performance.now() - start, checksum };
}

for (const [name, value] of [
  ["Latin bio (240 characters)", "Café, música y montaña. ".repeat(11).slice(0, 240)],
  ["Unicode bio", "Café e\u0301 👩🏽‍💻 🇪🇸 ".repeat(12)]
]) {
  const before = measure(previousCount, value);
  const after = measure(graphemeCount, value);
  if (before.checksum !== after.checksum) throw new Error(`Count mismatch: ${name}`);
  console.log(`${name}: before ${before.ms.toFixed(1)} ms; after ${after.ms.toFixed(1)} ms (20,000 counts)`);
}
