import { describe, expect, it } from "vitest";
import { describeSlotMode, takeoverConfigPatch } from "../src/memory-slot.js";

describe("takeoverConfigPatch", () => {
  it("points the memory slot at spectron", () => {
    expect(takeoverConfigPatch()).toEqual({ plugins: { slots: { memory: "spectron" } } });
  });
});

describe("describeSlotMode", () => {
  it("reports takeover when spectron owns the slot", () => {
    expect(describeSlotMode("spectron")).toContain("takeover");
  });

  it("names the current owner when another plugin holds it", () => {
    expect(describeSlotMode("memory-core")).toContain("memory-core");
  });

  it("reports augment when no slot is set", () => {
    expect(describeSlotMode(undefined)).toContain("augment");
  });
});
