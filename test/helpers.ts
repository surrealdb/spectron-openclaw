import { resolveConfig, type ResolvedConfig } from "../src/config.js";

const ENV = {
  SPECTRON_ENDPOINT: "https://ep.example",
  SPECTRON_API_KEY: "sp-secret",
  SPECTRON_CONTEXT: "acme",
};

const BASE = {
  endpoint: "${SPECTRON_ENDPOINT}",
  apiKey: "${SPECTRON_API_KEY}",
  context: "${SPECTRON_CONTEXT}",
};

/** Builds a resolved config with optional raw overrides. */
export function makeConfig(overrides: Record<string, unknown> = {}): ResolvedConfig {
  return resolveConfig({ ...BASE, ...overrides }, ENV);
}
