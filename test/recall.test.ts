import { describe, expect, it } from "vitest";
import { buildRecallContext, onPromptBuild, MEMORY_OPEN } from "../src/hooks/recall.js";
import { FakeSpectron } from "./fake.js";
import { makeConfig } from "./helpers.js";

describe("buildRecallContext", () => {
  it("returns null for an empty query", async () => {
    const client = new FakeSpectron();
    expect(await buildRecallContext(client, makeConfig(), "  ")).toBeNull();
    expect(client.calls.length).toBe(0);
  });

  it("uses context() in context mode and wraps the body", async () => {
    const client = new FakeSpectron({ context: "user likes dark mode" });
    const out = await buildRecallContext(client, makeConfig(), "prefs");
    expect(out).toContain(MEMORY_OPEN);
    expect(out).toContain("user likes dark mode");
    expect(client.callTo("context")?.[0]).toBe("prefs");
  });

  it("returns null when context is empty", async () => {
    const client = new FakeSpectron({ context: "" });
    expect(await buildRecallContext(client, makeConfig(), "prefs")).toBeNull();
  });

  it("uses recall() in recall mode and formats hits", async () => {
    const client = new FakeSpectron({
      hits: [
        { id: "1", score: 0.9, source: "fact", text: "alpha" },
        { id: "2", score: 0.8, source: "fact", text: "beta" },
      ],
    });
    const out = await buildRecallContext(client, makeConfig({ injectMode: "recall" }), "q");
    expect(client.countOf("recall")).toBe(1);
    expect(out).toContain("- alpha");
    expect(out).toContain("- beta");
  });

  it("passes recallK and lens through", async () => {
    const client = new FakeSpectron({ context: "x" });
    await buildRecallContext(client, makeConfig({ recallK: 9, recallScope: "team/eng" }), "q");
    const opts = client.callTo("context")?.[1] as { k?: number; lens?: unknown };
    expect(opts.k).toBe(9);
    expect(opts.lens).toBe("team/eng");
  });
});

describe("onPromptBuild", () => {
  it("returns a prependContext result", async () => {
    const client = new FakeSpectron({ context: "memory body" });
    const res = await onPromptBuild(client, makeConfig(), "q");
    expect(res?.prependContext).toContain("memory body");
  });

  it("swallows errors and returns null", async () => {
    const client = new FakeSpectron({ throwOn: { context: new Error("boom") } });
    const warnings: string[] = [];
    const res = await onPromptBuild(client, makeConfig(), "q", {
      warn: (m) => warnings.push(m),
    });
    expect(res).toBeNull();
    expect(warnings.length).toBe(1);
  });
});
