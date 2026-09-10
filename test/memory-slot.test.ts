import { describe, expect, it } from "vitest";
import { describeSlotMode, takeoverConfigPatch } from "../src/memory-slot.js";

describe("takeoverConfigPatch", () => {
  it("points the memory slot at agentMemory", () => {
    expect(takeoverConfigPatch()).toEqual({ plugins: { slots: { memory: "agentMemory" } } });
  });
});

describe("describeSlotMode", () => {
  it("reports takeover when agentMemory owns the slot", () => {
    expect(describeSlotMode("agentMemory")).toContain("takeover");
  });

  it("names the current owner when another plugin holds it", () => {
    expect(describeSlotMode("memory-core")).toContain("memory-core");
  });

  it("reports augment when no slot is set", () => {
    expect(describeSlotMode(undefined)).toContain("augment");
  });
});
