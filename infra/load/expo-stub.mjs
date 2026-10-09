import http from "node:http";

const port = Number(process.env.EXPO_STUB_PORT || 9320);
const delay = Number(process.env.EXPO_STUB_DELAY_MS || 100);
const failEvery = Number(process.env.EXPO_STUB_FAIL_EVERY || 0);
const host = process.env.EXPO_STUB_HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535 ||
    !Number.isInteger(delay) || delay < 0 || delay > 60_000 ||
    !Number.isInteger(failEvery) || failEvery < 0) {
  throw new Error("Invalid Expo stub port, delay or failure interval");
}
let requests = 0;
let tickets = 0;

const server = http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/healthz") {
    res.end(JSON.stringify({ service: "snack-expo-stub", requests, tickets }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/--/api/v2/push/send") {
    res.writeHead(404).end("{}");
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy();
  });
  req.on("end", () => {
    let messages;
    try { messages = JSON.parse(body); } catch { res.writeHead(400).end("{}"); return; }
    if (!Array.isArray(messages) || messages.length > 100) { res.writeHead(400).end("{}"); return; }
    const request = ++requests;
    setTimeout(() => {
      if (failEvery > 0 && request % failEvery === 0) {
        res.writeHead(503).end(JSON.stringify({ errors: [{ code: "LOAD_TEST_OUTAGE" }] }));
      } else {
        tickets += messages.length;
        res.end(JSON.stringify({ data: messages.map((_, i) => ({ status: "ok", id: `load-${request}-${i}` })) }));
      }
    }, delay);
  });
});
server.listen(port, host, () => {
  console.log(`Expo load stub listening on http://${host}:${server.address().port}; delay=${delay}ms, failEvery=${failEvery}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
