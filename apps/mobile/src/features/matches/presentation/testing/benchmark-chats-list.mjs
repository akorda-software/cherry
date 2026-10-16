// Ejecutar desde el repo: node --experimental-strip-types \
//   apps/mobile/src/features/matches/presentation/testing/benchmark-chats-list.mjs
// Solo coste del modelo JS; NO mide layout, memoria nativa, desplazamiento ni FPS.
import { performance } from "node:perf_hooks";
import { buildChatsListItems } from "../chats-list-model.ts";

for (const count of [1_000, 10_000, 50_000]) {
  // El modelo solo lee el id y conserva la referencia al resto del match.
  const matches = Array.from({ length: count }, (_, id) => ({ id: String(id) }));
  for (let warm = 0; warm < 25; warm++) buildChatsListItems([], matches);
  const samples = [];
  for (let run = 0; run < 100; run++) {
    const start = performance.now();
    const rows = buildChatsListItems([], matches);
    samples.push(performance.now() - start);
    if (rows.length !== count + 1 || rows[count].match !== matches[count - 1]) throw new Error("Invalid list model");
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({
    matches: count,
    medianMs: +samples[50].toFixed(3),
    p95Ms: +samples[95].toFixed(3),
    rows: count + 1
  }));
}
