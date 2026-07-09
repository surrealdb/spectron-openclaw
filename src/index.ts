// @surrealdb/spectron-openclaw
//
// OpenClaw plugin that backs agent memory with SurrealDB Spectron. It runs in
// augment mode by default: automatic recall injects memory before each turn,
// automatic persistence saves each turn afterwards, a session-end pass
// consolidates, and seven tools plus an `openclaw spectron` CLI give deliberate
// access. Optional takeover claims OpenClaw's exclusive memory slot.
//
// Registration is defensive: every api member is feature-detected so the
// plugin degrades gracefully across OpenClaw versions rather than throwing
// during load.

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { getClient } from "./client.js";
import { resolveConfig, type ResolvedConfig } from "./config.js";
import { bootstrap } from "./hooks/bootstrap.js";
import { consolidateSession } from "./hooks/consolidate.js";
import { onPromptBuild } from "./hooks/recall.js";
import { persistTurn } from "./hooks/persist.js";
import { buildTools } from "./tools.js";
import {
  forgetCommand,
  healthCommand,
  indexCommand,
  recallCommand,
  reflectCommand,
  setupCommand,
  statusCommand,
  type CliContext,
} from "./cli.js";
import type { MemoryClient, OpenClawPluginApi, PluginLogger } from "./types.js";

const PLUGIN_ID = "spectron";

/** Best-effort noop logger when the api does not supply one. */
function makeLogger(api: OpenClawPluginApi): PluginLogger {
  return (
    api.logger ?? {
      info: () => {},
      warn: () => {},
      error: () => {},
    }
  );
}

function hookFlag(api: OpenClawPluginApi, name: string): boolean {
  return api.hooks?.[name] === true;
}

/** Registers a hook via whichever registration method the api exposes. */
function on(api: OpenClawPluginApi, event: string, handler: (payload: any) => unknown): void {
  if (typeof api.on === "function") api.on(event, handler);
  else if (typeof api.registerHook === "function") api.registerHook(event, handler);
}

function extractQuery(payload: any): string {
  return (
    payload?.prompt ?? payload?.query ?? payload?.userPrompt ?? payload?.input ?? ""
  ).toString();
}

function extractMessages(payload: any): unknown[] | undefined {
  return payload?.messages ?? payload?.transcript ?? payload?.turn?.messages;
}

function extractWorkspaceDir(api: OpenClawPluginApi, payload?: any): string | undefined {
  return (
    payload?.workspaceDir ??
    payload?.ctx?.workspaceDir ??
    (typeof api.resolvePath === "function" ? api.resolvePath(".") : undefined)
  );
}

function registerHooks(
  api: OpenClawPluginApi,
  config: ResolvedConfig,
  client: MemoryClient,
  log: PluginLogger,
): void {
  // Auto-recall: inject memory before the prompt is built.
  if (config.autoRecall) {
    if (hookFlag(api, "allowPromptInjection")) {
      on(api, "before_prompt_build", async (payload) => {
        const result = await onPromptBuild(client, config, extractQuery(payload), log);
        return result ?? undefined;
      });
    } else {
      log.warn(
        "spectron: autoRecall is on but hooks.allowPromptInjection is not set; " +
          "recall injection is disabled. Run `openclaw spectron setup`.",
      );
    }
  }

  // Auto-persist: save the turn after the agent finishes.
  if (config.autoCapture) {
    if (hookFlag(api, "allowConversationAccess")) {
      on(api, "agent_end", async (payload) => {
        await persistTurn(client, config, extractMessages(payload) as any, log);
      });
    } else {
      log.warn(
        "spectron: autoCapture is on but hooks.allowConversationAccess is not set; " +
          "per-turn persistence is disabled (OpenClaw will not deliver agent_end). " +
          "Run `openclaw spectron setup`.",
      );
    }
  }

  // Consolidate at session end.
  if (config.autoConsolidate) {
    on(api, "session_end", async () => {
      await consolidateSession(client, config, log);
    });
  }

  // Health check and optional workspace seeding on gateway start.
  on(api, "gateway_start", async (payload) => {
    await bootstrap(client, config, extractWorkspaceDir(api, payload), log);
  });
}

function registerTools(
  api: OpenClawPluginApi,
  config: ResolvedConfig,
  resolve: () => MemoryClient,
  log: PluginLogger,
): void {
  if (typeof api.registerTool !== "function") {
    log.warn("spectron: api.registerTool unavailable; agent tools not registered");
    return;
  }
  for (const tool of buildTools(resolve, config)) {
    api.registerTool(tool);
  }
}

function registerCli(
  api: OpenClawPluginApi,
  makeCtx: () => CliContext,
  log: PluginLogger,
): void {
  if (typeof api.registerCli !== "function") return;

  // Targets the documented registerCli shape: a parent command named after the
  // plugin with a list of subcommands. Wrapped so a shape mismatch on a given
  // OpenClaw version does not break plugin load.
  const commands = [
    {
      name: "setup",
      description: "Print the config and permission flags to enable the plugin.",
      run: async (args: Record<string, unknown>) => setupCommand({ takeover: args.takeover === true }),
    },
    { name: "status", description: "Show configuration, slot mode, and identity.", run: () => statusCommand(makeCtx()) },
    { name: "health", description: "Check the Spectron connection.", run: () => healthCommand(makeCtx()) },
    { name: "index", description: "Seed workspace memory files into the context.", run: () => indexCommand(makeCtx()) },
    {
      name: "recall",
      description: "Search memory. Usage: recall <query>",
      run: (args: Record<string, unknown>) => recallCommand(makeCtx(), String(args.query ?? args._ ?? "")),
    },
    {
      name: "reflect",
      description: "Synthesise an answer from memory. Usage: reflect <query>",
      run: (args: Record<string, unknown>) => reflectCommand(makeCtx(), String(args.query ?? args._ ?? "")),
    },
    {
      name: "forget",
      description: "Forget memories. Usage: forget <query> [--purge]",
      run: (args: Record<string, unknown>) =>
        forgetCommand(makeCtx(), String(args.query ?? args._ ?? ""), { purge: args.purge === true }),
    },
  ];

  try {
    api.registerCli({ name: PLUGIN_ID, description: "SurrealDB Spectron memory.", commands });
  } catch (err) {
    log.warn("spectron: CLI registration failed", err);
  }
}

export default definePluginEntry({
  id: PLUGIN_ID,
  name: "SurrealDB Spectron",
  description: "Backs OpenClaw agent memory with SurrealDB Spectron.",
  register(api: OpenClawPluginApi) {
    const log = makeLogger(api);

    let config: ResolvedConfig | null = null;
    try {
      config = resolveConfig(api.pluginConfig);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(message);
    }

    const resolve = (): MemoryClient => {
      if (!config) throw new Error("spectron is not configured");
      return getClient(config);
    };

    const makeCtx = (): CliContext => ({
      resolve,
      config,
      workspaceDir: extractWorkspaceDir(api),
    });

    // CLI is always available so `setup` works before config exists.
    registerCli(api, makeCtx, log);

    if (config) {
      const client = getClient(config);
      registerTools(api, config, resolve, log);
      registerHooks(api, config, client, log);
      log.info(`spectron: ready (context ${config.context})`);
    } else {
      log.warn("spectron: not configured; only the `openclaw spectron setup` command is active.");
    }
  },
});
