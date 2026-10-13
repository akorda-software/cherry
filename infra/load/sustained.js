import http from "k6/http";
import ws from "k6/ws";
import exec from "k6/execution";
import { check, fail } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Rate, Trend } from "k6/metrics";

const base = (__ENV.BASE_URL || "http://127.0.0.1:5511").replace(/\/$/, "");
const actors = new SharedArray("actors", () => JSON.parse(open(__ENV.LOAD_MANIFEST || "./actors.json")).actors);
const rate = Number(__ENV.TARGET_RPS || 50);
const httpVus = Number(__ENV.HTTP_VUS || 100);
const maxHttpVus = Number(__ENV.HTTP_MAX_VUS || httpVus);
const wsUsers = Number(__ENV.WS_USERS || 20);
const ramp = __ENV.RAMP_DURATION || "1m";
const hold = __ENV.HOLD_DURATION || "15m";
const down = __ENV.DOWN_DURATION || "30s";
const socketSeconds = Number(__ENV.WS_SESSION_SECONDS || 60);
const messageSeconds = Number(__ENV.WS_MESSAGE_SECONDS || 20);
const errors = new Rate("api_errors");
const wsJoined = new Rate("ws_join_success");
const wsAck = new Rate("ws_message_ack_success");
const wsJoinMs = new Trend("ws_join_ms", true);
const wsAckMs = new Trend("ws_message_ack_ms", true);
const wsReceived = new Counter("ws_messages_received");
const wsUnexpectedClose = new Rate("ws_unexpected_close");
const staleSwipes = new Counter("stale_swipes");

if (actors.length < maxHttpVus + wsUsers) throw new Error("Manifest needs at least HTTP_MAX_VUS + WS_USERS independent actors");
if (!(rate > 0 && httpVus > 0 && maxHttpVus >= httpVus && wsUsers >= 0 && socketSeconds >= 5 && messageSeconds > 0)) {
  throw new Error("Invalid load configuration");
}

export const options = {
  summaryTrendStats: ["min", "avg", "med", "max", "p(90)", "p(95)", "p(99)"],
  // IDs in paths and auth query parameters must not become metric labels.
  systemTags: ["status", "method", "name", "group", "check", "error", "error_code", "scenario", "expected_response"],
  scenarios: {
    http_api: {
      executor: "ramping-arrival-rate", exec: "api", startRate: 1, timeUnit: "1s",
      preAllocatedVUs: httpVus, maxVUs: maxHttpVus,
      stages: [{ duration: ramp, target: rate }, { duration: hold, target: rate }, { duration: down, target: 0 }],
      gracefulStop: "15s"
    },
    ...(wsUsers > 0 ? {
      chat_sockets: {
        executor: "ramping-vus", exec: "chat", startVUs: 0,
        stages: [{ duration: ramp, target: wsUsers }, { duration: hold, target: wsUsers }, { duration: down, target: 0 }],
        gracefulRampDown: "5s", gracefulStop: "10s"
      }
    } : {})
  },
  thresholds: {
    api_errors: ["rate<0.005"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:http_api}": ["p(95)<500", "p(99)<1500"],
    dropped_iterations: ["count==0"],
    ...(wsUsers > 0 ? {
      ws_join_success: ["rate>0.99"], ws_message_ack_success: ["rate>0.99"],
      ws_join_ms: ["p(95)<1000"], ws_message_ack_ms: ["p(95)<500", "p(99)<1500"],
      ws_unexpected_close: ["rate<0.01"]
    } : {})
  }
};

let identity;
let candidates = [];
let inboxCursor = null;

function actor() {
  if (!identity) {
    const fixture = actors[exec.vu.idInTest - 1];
    if (!fixture) fail("No independent session for this VU");
    identity = { ...fixture, expires: Date.parse(fixture.accessTokenExpiresAt) };
  }
  if (Date.now() + 60_000 >= identity.expires) {
    const response = http.post(`${base}/api/session/refresh`, JSON.stringify({ refreshToken: identity.refreshToken }), {
      headers: { "content-type": "application/json" }, tags: { name: "POST /api/session/refresh" }, timeout: "10s"
    });
    const ok = response.status === 200;
    errors.add(!ok);
    if (!ok) fail(`Session refresh failed (${response.status}); export a fresh manifest before each run`);
    const session = response.json();
    identity.accessToken = session.accessToken;
    identity.refreshToken = session.refreshToken;
    identity.expires = Date.parse(session.accessTokenExpiresAt);
  }
  return identity;
}

function request(method, path, body, name, allowStale = false) {
  const user = actor();
  const params = {
    headers: { authorization: `Bearer ${user.accessToken}`, "content-type": "application/json" },
    tags: { name: name || `${method} ${path.split("?")[0]}` }, timeout: "10s"
  };
  if (allowStale) params.responseCallback = http.expectedStatuses(200, 409, 422);
  const response = http.request(method, `${base}${path}`, body ? JSON.stringify(body) : null, params);
  const stale = allowStale && [409, 422].includes(response.status) && ["already_swiped", "profile_not_found"].includes(response.json("error"));
  if (stale) staleSwipes.add(1);
  const ok = response.status === 200 || stale;
  errors.add(!ok);
  check(response, { "API status is valid": () => ok });
  return response;
}

export function setup() {
  const ready = http.get(`${base}/readyz`, { tags: { name: "GET /readyz" } });
  if (ready.status !== 200) fail(`Backend is not ready (${ready.status})`);
}

export function api() {
  const user = actor();
  const choice = Math.random();
  if (choice < 0.30) {
    const response = request("GET", "/api/discovery/feed?limit=20", null, "GET /api/discovery/feed");
    if (response.status === 200) candidates = (response.json("profiles") || []).map((profile) => profile.id);
  } else if (choice < 0.50) {
    request("GET", "/api/me/summary");
  } else if (choice < 0.65) {
    const path = `/api/matches?limit=50${inboxCursor ? `&cursor=${encodeURIComponent(inboxCursor)}` : ""}`;
    const response = request("GET", path, null, "GET /api/matches");
    if (response.status === 200) inboxCursor = response.json("nextCursor");
  } else if (choice < 0.75) {
    request("GET", `/api/conversations/${user.conversationId}/messages?limit=40`, null, "GET /api/conversations/:id/messages");
  } else if (choice < 0.85) {
    request("GET", "/api/likes/received?limit=30", null, "GET /api/likes/received");
  } else if (choice < 0.90 && candidates.length > 0) {
    request("POST", "/api/discovery/actions", { target_profile_id: candidates.shift(), action_type: Math.random() < 0.5 ? "like" : "dislike" }, "POST /api/discovery/actions", true);
  } else if (choice < 0.95) {
    request("POST", `/api/conversations/${user.conversationId}/messages`, { body: "Mensaje sintético REST" }, "POST /api/conversations/:id/messages");
  } else {
    request("POST", `/api/conversations/${user.conversationId}/read`, {}, "POST /api/conversations/:id/read");
  }
}

export function chat() {
  const user = actor();
  const url = `${base.replace(/^http/, "ws")}/socket/websocket?vsn=2.0.0&token=${encodeURIComponent(user.accessToken)}`;
  const topic = `chat:${user.conversationId}`;
  const response = ws.connect(url, { tags: { name: "WS /socket/websocket" } }, (socket) => {
    let ref = 1;
    let joined = false;
    let joinRecorded = false;
    let expectedClose = false;
    const pending = new Map();
    const started = Date.now();
    const send = (event, payload) => {
      const id = String(++ref);
      socket.send(JSON.stringify(["1", id, topic, event, payload]));
      return id;
    };
    const sendMessage = () => {
      if (!joined || Date.now() - started > socketSeconds * 1000 - 3000) return;
      const id = send("send_message", { body: "Mensaje sintético WebSocket" });
      pending.set(id, Date.now());
    };
    socket.on("open", () => socket.send(JSON.stringify(["1", "1", topic, "phx_join", {}])));
    socket.on("message", (raw) => {
      const [, replyRef, , event, payload] = JSON.parse(raw);
      if (event === "phx_reply" && replyRef === "1") {
        joined = payload.status === "ok";
        joinRecorded = true;
        wsJoined.add(joined);
        wsJoinMs.add(Date.now() - started);
        if (joined) sendMessage();
      } else if (event === "phx_reply" && pending.has(replyRef)) {
        wsAck.add(payload.status === "ok");
        wsAckMs.add(Date.now() - pending.get(replyRef));
        pending.delete(replyRef);
      } else if (event === "new_message") {
        wsReceived.add(1);
      } else if (event === "phx_error" || event === "phx_close") {
        socket.close();
      }
    });
    socket.on("error", () => wsJoined.add(false));
    socket.on("close", () => {
      wsUnexpectedClose.add(!expectedClose);
      if (!joinRecorded) wsJoined.add(false);
      for (const _ref of pending.keys()) wsAck.add(false);
      pending.clear();
    });
    socket.setInterval(() => socket.send(JSON.stringify([null, String(++ref), "phoenix", "heartbeat", {}])), 25_000);
    socket.setInterval(() => { if (joined) send("typing", {}); }, 10_000);
    socket.setInterval(sendMessage, messageSeconds * 1000);
    socket.setTimeout(() => {
      expectedClose = true;
      socket.close();
    }, socketSeconds * 1000);
  });
  errors.add(response.status !== 101);
}

export function handleSummary(data) {
  return { [__ENV.LOAD_RESULTS || "results/summary.json"]: JSON.stringify(data, null, 2),
    stdout: `Load finished: ${data.metrics.http_reqs.values.count} HTTP requests; API error rate ${data.metrics.api_errors.values.rate}\n` };
}
