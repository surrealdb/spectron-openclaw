import { describe, expect, it } from "vitest";
import { coerceScope } from "../src/scopes.js";

describe("coerceScope", () => {
  it("returns undefined for null/empty", () => {
    expect(coerceScope(null)).toBeUndefined();
    expect(coerceScope(undefined)).toBeUndefined();
    expect(coerceScope("")).toBeUndefined();
    expect(coerceScope("   ")).toBeUndefined();
    expect(coerceScope([])).toBeUndefined();
  });

  it("trims and passes a bare path", () => {
    expect(coerceScope("  team/eng  ")).toBe("team/eng");
  });

  it("keeps an OR of single paths", () => {
    expect(coerceScope(["a", "b"])).toEqual(["a", "b"]);
  });

  it("keeps a nested AND clause", () => {
    expect(coerceScope([["a", "b"]])).toEqual([["a", "b"]]);
  });

  it("drops empty entries and non-strings", () => {
    expect(coerceScope(["a", "", 3, ["", "c"]])).toEqual(["a", ["c"]]);
  });

  it("returns undefined when everything is empty", () => {
    expect(coerceScope(["", ["", ""]])).toBeUndefined();
  });
});
