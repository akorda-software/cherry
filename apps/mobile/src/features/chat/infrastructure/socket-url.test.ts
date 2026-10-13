import { describe, expect, it } from "vitest";

import { socketUrlFromApiBase } from "./socket-url";

describe("socketUrlFromApiBase", () => {
  it("maps http to ws and https to wss", () => {
    expect(socketUrlFromApiBase("http://localhost:4000")).toBe("ws://localhost:4000/socket");
    expect(socketUrlFromApiBase("https://api.cherry.app")).toBe("wss://api.cherry.app/socket");
    expect(socketUrlFromApiBase("HTTPS://api.cherry.app")).toBe("wss://api.cherry.app/socket");
  });

  it("keeps path prefixes and drops trailing slashes, queries and hashes", () => {
    expect(socketUrlFromApiBase("https://cherry.example.org/api-root/")).toBe("wss://cherry.example.org/api-root/socket");
    expect(socketUrlFromApiBase("http://192.168.3.34:4000/?x=1#y")).toBe("ws://192.168.3.34:4000/socket");
  });

  it("uses the web origin when the base URL is empty", () => {
    expect(socketUrlFromApiBase("", "https://cherry.example.org")).toBe("wss://cherry.example.org/socket");
    expect(socketUrlFromApiBase("  ", "http://localhost:8081")).toBe("ws://localhost:8081/socket");
  });

  it("returns null when it cannot build a URL", () => {
    expect(socketUrlFromApiBase("")).toBeNull();
    expect(socketUrlFromApiBase("not a url")).toBeNull();
  });
});
