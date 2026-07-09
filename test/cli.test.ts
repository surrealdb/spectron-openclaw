import { describe, expect, it } from "vitest";
import {
  forgetCommand,
  healthCommand,
  recallCommand,
  setupCommand,
  statusCommand,
  type CliContext,
} from "../src/cli.js";
import { FakeSpectron } from "./fake.js";
import { makeConfig } from "./helpers.js";

function ctx(client: FakeSpectron, overrides: Partial<CliContext> = {}): CliContext {
  return {
    resolve: () => client,
    config: makeConfig(),
    ...overrides,
  };
}

describe("setupCommand", () => {
  it("includes both required hook flags", () => {
    const out = setupCommand();
    expect(out).toContain("allowConversationAccess");
    expect(out).toContain("allowPromptInjection");
    expect(out).toContain("augment mode");
  });

  it("adds the slot patch under --takeover", () => {
    const out = setupCommand({ takeover: true });
    expect(out).toContain("slots");
    expect(out).toContain('"memory": "spectron"');
  });
});

describe("status/health", () => {
  it("errors clearly when unconfigured", async () => {
    const client = new FakeSpectron();
    await expect(statusCommand(ctx(client, { config: null }))).rejects.toThrow(/not configured/);
  });

  it("summarises config and identity", async () => {
    const client = new FakeSpectron();
    const out = await statusCommand(ctx(client));
    expect(out).toContain("context:    acme");
    expect(out).toContain("augment");
    expect(out).toContain("agent:test");
  });

  it("shows takeover slot mode when spectron owns the slot", async () => {
    const client = new FakeSpectron();
    const out = await statusCommand(ctx(client, { currentSlot: "spectron" }));
    expect(out).toContain("takeover");
  });

  it("health returns healthy", async () => {
    const client = new FakeSpectron();
    expect(await healthCommand(ctx(client))).toContain("healthy");
  });

  it("health surfaces failures", async () => {
    const client = new FakeSpectron({ healthError: new Error("down") });
    await expect(healthCommand(ctx(client))).rejects.toThrow("down");
  });
});

describe("query commands", () => {
  it("recall requires a query", async () => {
    const client = new FakeSpectron();
    await expect(recallCommand(ctx(client), "")).rejects.toThrow(/usage/);
  });

  it("recall prints ranked hits", async () => {
    const client = new FakeSpectron({ hits: [{ id: "1", score: 0.5, source: "fact", text: "beta" }] });
    expect(await recallCommand(ctx(client), "q")).toContain("beta");
  });

  it("forget passes purge through", async () => {
    const client = new FakeSpectron({ deleted: 1 });
    const out = await forgetCommand(ctx(client), "notes", { purge: true });
    expect(out).toContain("1");
    expect((client.callTo("forget")?.[1] as any).purge).toBe(true);
  });
});
