import { describe, expect, it } from "vitest";
import { toBatchMessages } from "../src/transcript.js";

describe("toBatchMessages", () => {
  it("returns empty for non-arrays", () => {
    expect(toBatchMessages(undefined)).toEqual([]);
  });

  it("maps role and string content, dropping metadata fields", () => {
    const out = toBatchMessages([
      { role: "user", content: "hi", sender: "x", threadId: "t", forwardedFrom: "y" } as any,
    ]);
    expect(out).toEqual([{ role: "user", content: "hi" }]);
  });

  it("normalises alternate role labels", () => {
    const out = toBatchMessages([
      { role: "human", content: "a" },
      { role: "ai", content: "b" },
      { role: "model", content: "c" },
      { role: "assistant", content: "d" },
    ]);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "assistant", "assistant"]);
  });

  it("defaults an unknown role to user", () => {
    expect(toBatchMessages([{ role: "captain", content: "x" }])[0]?.role).toBe("user");
  });

  it("joins array content blocks", () => {
    const out = toBatchMessages([
      { role: "assistant", content: [{ type: "text", text: "one" }, "two", { type: "image" }] },
    ]);
    expect(out[0]?.content).toBe("one\ntwo");
  });

  it("drops empty messages", () => {
    expect(toBatchMessages([{ role: "user", content: "   " }, { role: "user", content: [] }])).toEqual([]);
  });

  it("preserves a string timestamp", () => {
    const out = toBatchMessages([{ role: "user", content: "hi", ts: "2026-01-01T00:00:00Z" }]);
    expect(out[0]?.ts).toBe("2026-01-01T00:00:00Z");
  });
});
