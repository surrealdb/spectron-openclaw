// In-memory MemoryClient for tests. Records calls and returns canned responses
// so hooks, tools, and CLI handlers can be exercised without a live Agent Memory.

import type { BatchMessage, MemoryClient, Scope, UploadArgs } from "../src/types.js";

export interface Call {
  method: string;
  args: unknown[];
}

export interface FakeOptions {
  /** Ranked hits returned by recall(). */
  hits?: Array<{ id: string; score: number; source: string; text: string }>;
  /** Text returned by context(). */
  context?: string;
  /** Text returned by reflect(). */
  reflection?: string;
  /** created count returned by consolidate(). */
  consolidated?: number;
  /** deleted count returned by forget(). */
  deleted?: number;
  /** When set, health() rejects with this error. */
  healthError?: Error;
  /** When set, the named methods throw this error. */
  throwOn?: Record<string, Error>;
}

export class FakeAgentMemory implements MemoryClient {
  readonly calls: Call[] = [];
  readonly documents: { upload(args: UploadArgs): Promise<unknown> };

  constructor(private readonly opts: FakeOptions = {}) {
    this.documents = {
      upload: async (args: UploadArgs) => {
        this.record("documents.upload", args);
        return { id: "doc:1" };
      },
    };
  }

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
    const err = this.opts.throwOn?.[method];
    if (err) throw err;
  }

  /** Returns the args of the first recorded call to `method`. */
  callTo(method: string): unknown[] | undefined {
    return this.calls.find((c) => c.method === method)?.args;
  }

  countOf(method: string): number {
    return this.calls.filter((c) => c.method === method).length;
  }

  async health(): Promise<void> {
    this.record("health");
    if (this.opts.healthError) throw this.opts.healthError;
  }

  async remember(text?: string, options?: unknown): Promise<any> {
    this.record("remember", text, options);
    return { sessionId: "session:1", mode: "full" };
  }

  async rememberMany(messages: BatchMessage[], options?: unknown): Promise<any> {
    this.record("rememberMany", messages, options);
    return { sessionId: "session:1", turnIds: messages.map((_, i) => `turn:${i}`), extractions: [] };
  }

  async recall(query: string, options?: unknown): Promise<any> {
    this.record("recall", query, options);
    return {
      classificationKind: "hybrid",
      hits: this.opts.hits ?? [],
      queryMs: 1,
      seedEntities: [],
      tier: "tier1",
      trace: {},
    };
  }

  async context(query: string, options?: unknown): Promise<any> {
    this.record("context", query, options);
    return { context: this.opts.context ?? "", queryMs: 1, tier: "tier1" };
  }

  async reflect(query: string, options?: unknown): Promise<any> {
    this.record("reflect", query, options);
    return { reflection: this.opts.reflection ?? "", evidence: [], persistedAttributes: [], traceId: "t:1" };
  }

  async consolidate(options?: unknown): Promise<any> {
    this.record("consolidate", options);
    return { created: this.opts.consolidated ?? 0, dryRun: false, outcomes: [], superseded: 0, traceId: "t:1", updated: 0 };
  }

  async forget(query: string, options?: unknown): Promise<any> {
    this.record("forget", query, options);
    return { deleted: this.opts.deleted ?? 0 };
  }

  async inspect(ref: string): Promise<any> {
    this.record("inspect", ref);
    return { kind: "entity", entity: { name: ref }, attributes: [], relations: [] };
  }

  async state(): Promise<any> {
    this.record("state");
    return {};
  }

  async whoami(): Promise<any> {
    this.record("whoami");
    return { principal: "agent:test" };
  }

  onBehalfOf(principalId: string): MemoryClient {
    this.record("onBehalfOf", principalId);
    return this;
  }

  // Silence unused-scope lint in strict mode; Scope is part of the public
  // signatures the fake mirrors.
  _scope?: Scope;
}
