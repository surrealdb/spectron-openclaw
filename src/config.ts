// Reads and validates the plugin config from plugins.entries.spectron.config.
//
// Connection fields (endpoint, apiKey, context) support ${ENV_VAR} references
// so secrets stay out of openclaw.json. Everything else has a sensible default
// so a minimal config just needs the three connection fields.

import { coerceScope } from "./scopes.js";
import type { Scope } from "./types.js";

/** Where recall context is sourced from before injection. */
export type InjectMode = "context" | "recall";

export interface ResolvedConfig {
  endpoint: string;
  apiKey: string;
  context: string;
  /** Read lens applied to recall/context queries. Undefined = whole granted region. */
  recallLens: Scope;
  /** Scope the plugin writes memories to. Undefined = the key's default write region. */
  writeScope: Scope;
  /** Principal to act on behalf of for every call (X-Spectron-On-Behalf-Of). */
  onBehalfOf?: string;
  autoRecall: boolean;
  autoCapture: boolean;
  autoConsolidate: boolean;
  autoIndex: boolean;
  recallK: number;
  injectMode: InjectMode;
  infer: string;
  requestTimeoutMs: number;
}

const DEFAULTS = {
  autoRecall: true,
  autoCapture: true,
  autoConsolidate: true,
  autoIndex: true,
  recallK: 5,
  injectMode: "context" as InjectMode,
  infer: "full",
  requestTimeoutMs: 60_000,
};

const ENV_PATTERN = /^\$\{([A-Z0-9_]+)\}$/;

/**
 * Expands a single "${VAR}" reference against env. A plain string is returned
 * unchanged. A reference to an unset variable returns undefined so callers can
 * treat it as missing rather than as the literal "${VAR}".
 */
export function expandEnv(
  value: unknown,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(ENV_PATTERN);
  if (!match) return value;
  const name = match[1] as string;
  return env[name];
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** The three connection fields a working config must resolve. */
export function missingConnectionFields(
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const cfg = raw ?? {};
  const missing: string[] = [];
  if (!expandEnv(cfg.endpoint, env)) missing.push("endpoint");
  if (!expandEnv(cfg.apiKey, env)) missing.push("apiKey");
  if (!expandEnv(cfg.context, env)) missing.push("context");
  return missing;
}

/**
 * Resolves raw config into a fully defaulted, validated config. Throws with a
 * clear message when a connection field is missing so the gateway logs a
 * useful error instead of failing deep inside the SDK.
 */
export function resolveConfig(
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
): ResolvedConfig {
  const cfg = raw ?? {};
  const missing = missingConnectionFields(cfg, env);
  if (missing.length > 0) {
    throw new Error(
      `spectron plugin: missing required config field(s): ${missing.join(", ")}. ` +
        `Set them under plugins.entries.spectron.config (env references like ` +
        `"\${SPECTRON_API_KEY}" are supported).`,
    );
  }

  const injectRaw = typeof cfg.injectMode === "string" ? cfg.injectMode : DEFAULTS.injectMode;
  const injectMode: InjectMode = injectRaw === "recall" ? "recall" : "context";

  return {
    endpoint: expandEnv(cfg.endpoint, env) as string,
    apiKey: expandEnv(cfg.apiKey, env) as string,
    context: expandEnv(cfg.context, env) as string,
    recallLens: coerceScope(cfg.recallLens ?? cfg.recallScope),
    writeScope: coerceScope(cfg.writeScope),
    onBehalfOf: expandEnv(cfg.onBehalfOf, env),
    autoRecall: asBool(cfg.autoRecall, DEFAULTS.autoRecall),
    autoCapture: asBool(cfg.autoCapture, DEFAULTS.autoCapture),
    autoConsolidate: asBool(cfg.autoConsolidate, DEFAULTS.autoConsolidate),
    autoIndex: asBool(cfg.autoIndex, DEFAULTS.autoIndex),
    recallK: Math.max(1, Math.trunc(asNumber(cfg.recallK, DEFAULTS.recallK))),
    injectMode,
    infer: typeof cfg.infer === "string" ? cfg.infer : DEFAULTS.infer,
    requestTimeoutMs: Math.max(
      1_000,
      Math.trunc(asNumber(cfg.requestTimeoutMs, DEFAULTS.requestTimeoutMs)),
    ),
  };
}
