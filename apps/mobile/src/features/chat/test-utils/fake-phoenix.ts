/**
 * Doble de pruebas del cliente `phoenix` (solo tests: `vi.mock("phoenix", () => import(...))`).
 *
 * Reproduce la semántica que usa la sesión de chat:
 * - los hooks de `join()` se reutilizan en cada re-unión (como el `joinPush` real);
 * - una caída o cierre del socket pone en error los canales unidos (`phx_error`);
 * - al reabrir el socket, los canales en error vuelven a unirse (hay que responder de nuevo);
 * - `disconnect(cb)` cierra limpio y llama a `cb`.
 */

type Callback = (payload?: any) => void;

export class FakePush {
  readonly hooks: Array<{ status: string; callback: Callback }> = [];
  settled: string | null = null;

  constructor(
    readonly channel: FakeChannel,
    readonly event: string,
    readonly payload: unknown,
    readonly timeout?: number
  ) {}

  receive(status: string, callback: Callback): this {
    this.hooks.push({ status, callback });
    return this;
  }

  /** Simula la respuesta del servidor (o el timeout del cliente). */
  reply(status: "ok" | "error" | "timeout", response: unknown = {}): void {
    this.settled = status;
    this.hooks.filter((hook) => hook.status === status).forEach((hook) => hook.callback(response));
  }
}

export class FakeChannel {
  state: "closed" | "joining" | "joined" | "errored" | "leaving" = "closed";
  readonly pushes: FakePush[] = [];
  joinPush: FakePush | null = null;
  joinAttempts = 0;
  left = false;
  private bindings: Array<{ event: string; ref: number; callback: Callback }> = [];
  private bindingRef = 0;

  constructor(
    readonly topic: string,
    readonly params: unknown,
    readonly socket: FakeSocket
  ) {}

  on(event: string, callback: Callback): number {
    const ref = this.bindingRef++;
    this.bindings.push({ event, ref, callback });
    return ref;
  }

  off(event: string, ref?: number): void {
    this.bindings = this.bindings.filter(
      (binding) => !(binding.event === event && (ref === undefined || binding.ref === ref))
    );
  }

  onError(callback: Callback): number {
    return this.on("phx_error", callback);
  }

  onClose(callback: Callback): number {
    return this.on("phx_close", callback);
  }

  join(timeout?: number): FakePush {
    if (this.joinPush) {
      throw new Error("tried to join multiple times");
    }

    this.joinPush = new FakePush(this, "phx_join", this.params, timeout);
    this.state = "joining";
    this.joinAttempts = 1;
    return this.joinPush;
  }

  leave(): FakePush {
    this.state = "leaving";
    this.left = true;
    const push = new FakePush(this, "phx_leave", {});
    this.state = "closed";
    this.trigger("phx_close", "leave");
    this.socket.remove(this);
    return push;
  }

  push(event: string, payload: unknown, timeout?: number): FakePush {
    if (!this.joinPush) {
      throw new Error(`tried to push '${event}' to '${this.topic}' before joining`);
    }

    const push = new FakePush(this, event, payload, timeout);
    this.pushes.push(push);
    return push;
  }

  // ── helpers de test ──────────────────────────────────────────────────

  trigger(event: string, payload?: unknown): void {
    this.bindings.filter((binding) => binding.event === event).forEach((binding) => binding.callback(payload));
  }

  simulateJoinOk(response: unknown = {}): void {
    this.state = "joined";
    this.joinPush!.reply("ok", response);
  }

  simulateJoinError(response: unknown): void {
    this.state = "errored";
    this.joinPush!.reply("error", response);
  }

  simulateEvent(event: string, payload: unknown): void {
    this.trigger(event, payload);
  }

  /** Error del canal (p. ej. el proceso del servidor se cayó). */
  simulateError(reason: unknown = {}): void {
    if (this.state === "errored" || this.state === "closed" || this.state === "leaving") {
      return;
    }
    this.state = "errored";
    this.trigger("phx_error", reason);
  }

  pushesFor(event: string): FakePush[] {
    return this.pushes.filter((push) => push.event === event);
  }

  lastPush(event: string): FakePush | undefined {
    const matching = this.pushesFor(event);
    return matching[matching.length - 1];
  }

  /** Re-unión tras reabrir el socket (Phoenix reenvía el mismo joinPush). */
  rejoin(): void {
    if (this.left || !this.joinPush) {
      return;
    }
    this.state = "joining";
    this.joinAttempts += 1;
  }
}

export class FakeSocket {
  static instances: FakeSocket[] = [];

  static reset(): void {
    FakeSocket.instances = [];
  }

  static last(): FakeSocket {
    const socket = FakeSocket.instances[FakeSocket.instances.length - 1];
    if (!socket) {
      throw new Error("No FakeSocket was created");
    }
    return socket;
  }

  readonly channels: FakeChannel[] = [];
  readonly connectParams: Array<Record<string, unknown>> = [];
  connectCalls = 0;
  disconnectCalls = 0;
  private connected = false;
  private conn = false;
  private callbacks: Record<"open" | "close" | "error", Array<[string, Callback]>> = {
    open: [],
    close: [],
    error: []
  };
  private ref = 0;

  constructor(
    readonly endPoint: string,
    readonly options: Record<string, any> = {}
  ) {
    FakeSocket.instances.push(this);
  }

  params(): Record<string, unknown> {
    const params = this.options.params;
    return typeof params === "function" ? params() : (params ?? {});
  }

  connect(): void {
    this.connectCalls += 1;
    // Como Phoenix: si conserva una conexión (aunque esté caída) no hace nada.
    if (this.conn) {
      return;
    }
    this.conn = true;
    this.connectParams.push(this.params());
  }

  disconnect(callback?: () => void): void {
    this.disconnectCalls += 1;
    const hadConn = this.conn;
    this.conn = false;
    const wasConnected = this.connected;
    this.connected = false;

    if (hadConn) {
      this.triggerChannelErrors();
      if (wasConnected) {
        this.emit("close", { code: 1000 });
      }
    }

    callback?.();
  }

  isConnected(): boolean {
    return this.connected;
  }

  connectionState(): string {
    return this.connected ? "open" : "closed";
  }

  channel(topic: string, params: unknown = {}): FakeChannel {
    const channel = new FakeChannel(topic, params, this);
    this.channels.push(channel);
    return channel;
  }

  remove(channel: FakeChannel): void {
    const index = this.channels.indexOf(channel);
    if (index >= 0) {
      this.channels.splice(index, 1);
    }
  }

  onOpen(callback: Callback): string {
    return this.register("open", callback);
  }

  onClose(callback: Callback): string {
    return this.register("close", callback);
  }

  onError(callback: Callback): string {
    return this.register("error", callback);
  }

  off(refs: string[]): void {
    (Object.keys(this.callbacks) as Array<keyof typeof this.callbacks>).forEach((key) => {
      this.callbacks[key] = this.callbacks[key].filter(([ref]) => !refs.includes(ref));
    });
  }

  // ── helpers de test ──────────────────────────────────────────────────

  get hasConnection(): boolean {
    return this.conn;
  }

  /** El socket abre: los canales en error se vuelven a unir (responde con `simulateJoinOk`). */
  simulateOpen(): void {
    this.conn = true;
    this.connected = true;
    this.emit("open");
    this.channels.forEach((channel) => {
      if (channel.state === "errored") {
        channel.rejoin();
      }
    });
  }

  /** Error de transporte (rechazo del token, red caída…). La conexión queda muerta pero retenida. */
  simulateError(error: unknown = new Error("socket error")): void {
    this.connected = false;
    this.emit("error", error);
    this.triggerChannelErrors();
  }

  simulateClose(code = 1006): void {
    this.connected = false;
    this.triggerChannelErrors();
    this.emit("close", { code });
  }

  channelFor(topic: string): FakeChannel {
    const channel = this.channels.find((candidate) => candidate.topic === topic);
    if (!channel) {
      throw new Error(`No channel for ${topic}`);
    }
    return channel;
  }

  private register(kind: "open" | "close" | "error", callback: Callback): string {
    this.ref += 1;
    const ref = String(this.ref);
    this.callbacks[kind].push([ref, callback]);
    return ref;
  }

  private emit(kind: "open" | "close" | "error", payload?: unknown): void {
    this.callbacks[kind].forEach(([, callback]) => callback(payload));
  }

  private triggerChannelErrors(): void {
    this.channels.forEach((channel) => channel.simulateError({ source: "transport" }));
  }
}

export { FakeSocket as Socket, FakeChannel as Channel, FakePush as Push };
