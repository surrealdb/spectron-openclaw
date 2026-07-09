import { describe, expect, it } from "vitest";
import { buildTools } from "../src/tools.js";
import { FakeSpectron } from "./fake.js";
import { makeConfig } from "./helpers.js";
import type { ToolDefinition } from "../src/types.js";

function toolMap(client: FakeSpectron): Record<string, ToolDefinition> {
  const tools = buildTools(() => client, makeConfig({ writeScope: "team/eng" }));
  return Object.fromEntries(tools.map((t) => [t.name, t]));
}

describe("agent tools", () => {
  it("registers all seven", () => {
    const names = buildTools(() => new FakeSpectron(), makeConfig()).map((t) => t.name);
    expect(names).toEqual([
      "spectron_remember",
      "spectron_recall",
      "spectron_context",
      "spectron_reflect",
      "spectron_forget",
      "spectron_upload",
      "spectron_inspect",
    ]);
  });

  it("spectron_remember stores text with the write scope", async () => {
    const client = new FakeSpectron();
    const res = await toolMap(client).spectron_remember!.execute("1", { text: "a fact" });
    expect(res.isError).toBeUndefined();
    expect(res.content[0]?.text).toContain("Remembered");
    const [text, opts] = client.callTo("remember") as [string, any];
    expect(text).toBe("a fact");
    expect(opts.scopes).toBe("team/eng");
  });

  it("spectron_remember validates empty input", async () => {
    const client = new FakeSpectron();
    const res = await toolMap(client).spectron_remember!.execute("1", { text: "" });
    expect(res.isError).toBe(true);
    expect(client.countOf("remember")).toBe(0);
  });

  it("spectron_recall formats ranked hits", async () => {
    const client = new FakeSpectron({ hits: [{ id: "1", score: 0.912, source: "fact", text: "alpha" }] });
    const res = await toolMap(client).spectron_recall!.execute("1", { query: "q" });
    expect(res.content[0]?.text).toContain("0.912");
    expect(res.content[0]?.text).toContain("alpha");
  });

  it("spectron_recall reports no matches", async () => {
    const client = new FakeSpectron({ hits: [] });
    const res = await toolMap(client).spectron_recall!.execute("1", { query: "q" });
    expect(res.content[0]?.text).toBe("No matching memories.");
  });

  it("spectron_context returns the context text", async () => {
    const client = new FakeSpectron({ context: "briefing" });
    const res = await toolMap(client).spectron_context!.execute("1", { query: "q" });
    expect(res.content[0]?.text).toBe("briefing");
  });

  it("spectron_reflect returns the reflection", async () => {
    const client = new FakeSpectron({ reflection: "insight" });
    const res = await toolMap(client).spectron_reflect!.execute("1", { query: "q", persist: true });
    expect(res.content[0]?.text).toBe("insight");
    expect((client.callTo("reflect")?.[1] as any).persist).toBe(true);
  });

  it("spectron_forget reports the deleted count", async () => {
    const client = new FakeSpectron({ deleted: 2 });
    const res = await toolMap(client).spectron_forget!.execute("1", { query: "old notes", purge: true });
    expect(res.content[0]?.text).toContain("2");
    expect((client.callTo("forget")?.[1] as any).purge).toBe(true);
  });

  it("spectron_upload encodes text to a document", async () => {
    const client = new FakeSpectron();
    const res = await toolMap(client).spectron_upload!.execute("1", { text: "body", title: "Handbook" });
    expect(res.content[0]?.text).toContain("Handbook");
    const args = client.callTo("documents.upload")?.[0] as { file: Uint8Array; title: string };
    expect(args.title).toBe("Handbook");
    expect(new TextDecoder().decode(args.file)).toBe("body");
  });

  it("spectron_inspect returns JSON", async () => {
    const client = new FakeSpectron();
    const res = await toolMap(client).spectron_inspect!.execute("1", { ref: "entity:person/tobie" });
    expect(res.content[0]?.text).toContain("entity");
  });

  it("turns thrown SDK errors into error results", async () => {
    const client = new FakeSpectron({ throwOn: { recall: new Error("rate limited") } });
    const res = await toolMap(client).spectron_recall!.execute("1", { query: "q" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("rate limited");
  });
});
