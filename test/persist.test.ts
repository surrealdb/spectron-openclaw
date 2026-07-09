import { describe, expect, it } from "vitest";
import { persistTurn } from "../src/hooks/persist.js";
import { consolidateSession } from "../src/hooks/consolidate.js";
import { FakeSpectron } from "./fake.js";
import { makeConfig } from "./helpers.js";

describe("persistTurn", () => {
  it("sends stripped messages via rememberMany and returns the count", async () => {
    const client = new FakeSpectron();
    const n = await persistTurn(client, makeConfig({ writeScope: "team/eng" }), [
      { role: "user", content: "hello", sender: "x" } as any,
      { role: "assistant", content: "hi there" },
    ]);
    expect(n).toBe(2);
    const [messages, opts] = client.callTo("rememberMany") as [any[], any];
    expect(messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ]);
    expect(opts.scopes).toBe("team/eng");
    expect(opts.infer).toBe("full");
  });

  it("does nothing when there is no content", async () => {
    const client = new FakeSpectron();
    expect(await persistTurn(client, makeConfig(), [{ role: "user", content: "" }])).toBe(0);
    expect(client.countOf("rememberMany")).toBe(0);
  });

  it("swallows write errors", async () => {
    const client = new FakeSpectron({ throwOn: { rememberMany: new Error("nope") } });
    const warnings: string[] = [];
    const n = await persistTurn(client, makeConfig(), [{ role: "user", content: "x" }], {
      warn: (m) => warnings.push(m),
    });
    expect(n).toBe(0);
    expect(warnings.length).toBe(1);
  });
});

describe("consolidateSession", () => {
  it("is a no-op when disabled", async () => {
    const client = new FakeSpectron({ consolidated: 3 });
    expect(await consolidateSession(client, makeConfig({ autoConsolidate: false }))).toBe(0);
    expect(client.countOf("consolidate")).toBe(0);
  });

  it("returns the created count", async () => {
    const client = new FakeSpectron({ consolidated: 4 });
    expect(await consolidateSession(client, makeConfig())).toBe(4);
  });

  it("swallows errors", async () => {
    const client = new FakeSpectron({ throwOn: { consolidate: new Error("x") } });
    expect(await consolidateSession(client, makeConfig())).toBe(0);
  });
});
