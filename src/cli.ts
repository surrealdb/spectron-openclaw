// `openclaw agentMemory ...` command handlers.
//
// Each handler is a plain async function that returns the text to print (or
// throws on failure), so they can be unit tested without the OpenClaw CLI
// runtime. index.ts adapts these onto api.registerCli.

import type { ResolvedConfig } from "./config.js";
import { bootstrap } from "./hooks/bootstrap.js";
import { describeSlotMode, takeoverConfigPatch } from "./memory-slot.js";
import type { MemoryClient } from "./types.js";

export interface CliContext {
  /** Returns the memory client. Throws if config is unresolved. */
  resolve(): MemoryClient;
  /** Resolved config, or null when connection fields are missing. */
  config: ResolvedConfig | null;
  /** Current value of plugins.slots.memory, if known. */
  currentSlot?: unknown;
  /** Workspace directory for `index`. */
  workspaceDir?: string;
}

function requireConfig(ctx: CliContext): ResolvedConfig {
  if (!ctx.config) {
    throw new Error(
      "agentMemory is not configured. Run `openclaw agentMemory setup` and set endpoint, apiKey, and context.",
    );
  }
  return ctx.config;
}

/** Prints the config and permission flags needed to enable the plugin. */
export function setupCommand(opts: { takeover?: boolean } = {}): string {
  const configBlock = {
    plugins: {
      entries: {
        agentMemory: {
          enabled: true,
          hooks: { allowConversationAccess: true, allowPromptInjection: true },
          config: {
            endpoint: "${AGENT_MEMORY_ENDPOINT}",
            apiKey: "${AGENT_MEMORY_API_KEY}",
            context: "${AGENT_MEMORY_CONTEXT}",
          },
        },
      },
    },
  };

  const lines = [
    "Add this to ~/.openclaw/openclaw.json (merge with existing config):",
    "",
    JSON.stringify(configBlock, null, 2),
    "",
    "Then set the connection secrets in your environment:",
    "  export AGENT_MEMORY_ENDPOINT=...",
    "  export AGENT_MEMORY_API_KEY=...",
    "  export AGENT_MEMORY_CONTEXT=...",
    "",
    "The two hook flags are required: allowConversationAccess enables per-turn",
    "persistence (agent_end) and allowPromptInjection enables auto-recall.",
  ];

  if (opts.takeover) {
    lines.push(
      "",
      "Takeover (EXPERIMENTAL): also merge this to make Agent Memory the sole memory",
      "provider, disabling the built-in memory-core:",
      "",
      JSON.stringify(takeoverConfigPatch(), null, 2),
    );
  } else {
    lines.push(
      "",
      "This runs alongside built-in memory (augment mode). To make Agent Memory the",
      "sole provider instead, re-run with --takeover.",
    );
  }

  return lines.join("\n");
}

/** Summarises resolved config, slot mode, and identity. */
export async function statusCommand(ctx: CliContext): Promise<string> {
  const config = requireConfig(ctx);
  const lines = [
    `endpoint:   ${config.endpoint}`,
    `context:    ${config.context}`,
    `slot mode:  ${describeSlotMode(ctx.currentSlot)}`,
    `autoRecall=${config.autoRecall} autoCapture=${config.autoCapture} ` +
      `autoConsolidate=${config.autoConsolidate} autoIndex=${config.autoIndex}`,
    `recallK=${config.recallK} injectMode=${config.injectMode} infer=${config.infer}`,
  ];
  try {
    const me = await ctx.resolve().whoami();
    lines.push(`identity:   ${JSON.stringify(me)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lines.push(`identity:   unavailable (${message})`);
  }
  return lines.join("\n");
}

/** Liveness probe. */
export async function healthCommand(ctx: CliContext): Promise<string> {
  requireConfig(ctx);
  await ctx.resolve().health();
  return "agentMemory: healthy";
}

/** Re-seeds workspace memory files into the context. */
export async function indexCommand(ctx: CliContext): Promise<string> {
  const config = requireConfig(ctx);
  const res = await bootstrap(ctx.resolve(), { ...config, autoIndex: true }, ctx.workspaceDir);
  if (!res.ok) return "agentMemory: health check failed, nothing indexed";
  return `agentMemory: indexed ${res.uploaded} memory file(s)`;
}

export async function recallCommand(ctx: CliContext, query: string): Promise<string> {
  const config = requireConfig(ctx);
  if (!query || query.trim() === "") throw new Error("usage: openclaw agentMemory recall <query>");
  const res = await ctx.resolve().recall(query, { k: config.recallK, lens: config.recallLens });
  const hits = res.hits ?? [];
  if (hits.length === 0) return "No matching memories.";
  return hits.map((h, i) => `${i + 1}. [${h.score.toFixed(3)}] ${h.text}`).join("\n");
}

export async function reflectCommand(ctx: CliContext, query: string): Promise<string> {
  requireConfig(ctx);
  if (!query || query.trim() === "") throw new Error("usage: openclaw agentMemory reflect <query>");
  const res = await ctx.resolve().reflect(query, { persist: false });
  return res.reflection?.trim() || "No reflection produced.";
}

export async function forgetCommand(
  ctx: CliContext,
  query: string,
  opts: { purge?: boolean } = {},
): Promise<string> {
  requireConfig(ctx);
  if (!query || query.trim() === "") throw new Error("usage: openclaw agentMemory forget <query>");
  const res = await ctx.resolve().forget(query, { purge: opts.purge });
  return `Forgot ${res.deleted} memory row(s).`;
}
