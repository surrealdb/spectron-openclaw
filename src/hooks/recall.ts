// before_prompt_build: pull relevant memory for the incoming prompt and return
// it as context to prepend. Gated by autoRecall and, at registration time, by
// the allowPromptInjection permission flag.

import type { ResolvedConfig } from "../config.js";
import type { MemoryClient, PromptBuildResult } from "../types.js";

export const MEMORY_OPEN = "<agent_memory_memory>";
export const MEMORY_CLOSE = "</agent_memory_memory>";

/** Wraps recalled text in the tag the agent is told to treat as memory. */
export function wrapMemory(body: string): string {
  return `${MEMORY_OPEN}\n${body.trim()}\n${MEMORY_CLOSE}`;
}

/**
 * Fetches memory for `query` and returns the text to inject, or null when
 * there is nothing to add. In "context" mode AgentMemory returns preformatted
 * prompt text; in "recall" mode we format the ranked hits ourselves.
 */
export async function buildRecallContext(
  client: MemoryClient,
  config: ResolvedConfig,
  query: string,
): Promise<string | null> {
  const trimmed = query.trim();
  if (trimmed === "") return null;

  if (config.injectMode === "context") {
    const res = await client.context(trimmed, {
      k: config.recallK,
      lens: config.recallLens,
    });
    const body = res?.context?.trim();
    return body ? wrapMemory(body) : null;
  }

  const res = await client.recall(trimmed, {
    k: config.recallK,
    lens: config.recallLens,
  });
  const hits = res?.hits ?? [];
  if (hits.length === 0) return null;
  const body = hits.map((hit) => `- ${hit.text}`).join("\n");
  return wrapMemory(body);
}

/**
 * The before_prompt_build handler. Returns a PromptBuildResult (or null),
 * swallowing errors so a memory outage never blocks the agent turn.
 */
export async function onPromptBuild(
  client: MemoryClient,
  config: ResolvedConfig,
  query: string,
  log?: { warn(msg: string, ...a: unknown[]): void },
): Promise<PromptBuildResult | null> {
  try {
    const body = await buildRecallContext(client, config, query);
    return body ? { prependContext: body } : null;
  } catch (err) {
    log?.warn("agentMemory recall failed", err);
    return null;
  }
}
