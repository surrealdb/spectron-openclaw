import { resolveConfig, type ResolvedConfig } from "../src/config.js";

const ENV = {
  AGENT_MEMORY_ENDPOINT: "https://ep.example",
  AGENT_MEMORY_API_KEY: "sp-secret",
  AGENT_MEMORY_CONTEXT: "acme",
};

const BASE = {
  endpoint: "${AGENT_MEMORY_ENDPOINT}",
  apiKey: "${AGENT_MEMORY_API_KEY}",
  context: "${AGENT_MEMORY_CONTEXT}",
};

/** Builds a resolved config with optional raw overrides. */
export function makeConfig(overrides: Record<string, unknown> = {}): ResolvedConfig {
  return resolveConfig({ ...BASE, ...overrides }, ENV);
}
