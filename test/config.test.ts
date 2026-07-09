import { describe, expect, it } from "vitest";
import { expandEnv, missingConnectionFields, resolveConfig } from "../src/config.js";

const ENV = {
  SPECTRON_ENDPOINT: "https://ep.example",
  SPECTRON_API_KEY: "sp-secret",
  SPECTRON_CONTEXT: "acme",
};

describe("expandEnv", () => {
  it("passes plain strings through", () => {
    expect(expandEnv("literal", ENV)).toBe("literal");
  });

  it("expands ${VAR} references", () => {
    expect(expandEnv("${SPECTRON_API_KEY}", ENV)).toBe("sp-secret");
  });

  it("returns undefined for an unset reference", () => {
    expect(expandEnv("${NOT_SET}", ENV)).toBeUndefined();
  });

  it("returns undefined for non-strings", () => {
    expect(expandEnv(42, ENV)).toBeUndefined();
  });
});

describe("missingConnectionFields", () => {
  it("reports all three when empty", () => {
    expect(missingConnectionFields({}, {})).toEqual(["endpoint", "apiKey", "context"]);
  });

  it("reports a field whose env reference is unset", () => {
    const raw = { endpoint: "https://ep", apiKey: "${MISSING}", context: "c" };
    expect(missingConnectionFields(raw, {})).toEqual(["apiKey"]);
  });

  it("reports none when all resolve", () => {
    const raw = {
      endpoint: "${SPECTRON_ENDPOINT}",
      apiKey: "${SPECTRON_API_KEY}",
      context: "${SPECTRON_CONTEXT}",
    };
    expect(missingConnectionFields(raw, ENV)).toEqual([]);
  });
});

describe("resolveConfig", () => {
  const base = {
    endpoint: "${SPECTRON_ENDPOINT}",
    apiKey: "${SPECTRON_API_KEY}",
    context: "${SPECTRON_CONTEXT}",
  };

  it("throws with a helpful message when unconfigured", () => {
    expect(() => resolveConfig({}, {})).toThrow(/missing required config field/);
  });

  it("applies defaults", () => {
    const cfg = resolveConfig(base, ENV);
    expect(cfg.endpoint).toBe("https://ep.example");
    expect(cfg.context).toBe("acme");
    expect(cfg.autoRecall).toBe(true);
    expect(cfg.autoCapture).toBe(true);
    expect(cfg.autoConsolidate).toBe(true);
    expect(cfg.autoIndex).toBe(true);
    expect(cfg.recallK).toBe(5);
    expect(cfg.injectMode).toBe("context");
    expect(cfg.infer).toBe("full");
    expect(cfg.requestTimeoutMs).toBe(60000);
  });

  it("honours overrides and coerces string booleans/numbers", () => {
    const cfg = resolveConfig(
      { ...base, autoRecall: "false", recallK: "12", injectMode: "recall", infer: "none" },
      ENV,
    );
    expect(cfg.autoRecall).toBe(false);
    expect(cfg.recallK).toBe(12);
    expect(cfg.injectMode).toBe("recall");
    expect(cfg.infer).toBe("none");
  });

  it("falls back to context for an unknown injectMode", () => {
    expect(resolveConfig({ ...base, injectMode: "weird" }, ENV).injectMode).toBe("context");
  });

  it("coerces recallScope alias into recallLens", () => {
    const cfg = resolveConfig({ ...base, recallScope: "team/eng" }, ENV);
    expect(cfg.recallLens).toBe("team/eng");
  });
});
