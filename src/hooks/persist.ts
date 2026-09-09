// agent_end: persist the turn's conversation into AgentMemory so it becomes
// durable memory. Gated by autoCapture and, at registration time, by the
// allowConversationAccess permission flag (without which OpenClaw will not even
// deliver agent_end to a non-bundled plugin).

import type { ResolvedConfig } from "../config.js";
import { toBatchMessages, type RawMessage } from "../transcript.js";
import type { MemoryClient } from "../types.js";

/**
 * Persists the given messages via rememberMany. Returns the number of messages
 * sent (0 when nothing was worth persisting). Errors are swallowed and logged
 * so a memory write failure never surfaces as an agent error after the reply
 * has already been produced.
 */
export async function persistTurn(
  client: MemoryClient,
  config: ResolvedConfig,
  messages: readonly RawMessage[] | undefined,
  log?: { warn(msg: string, ...a: unknown[]): void },
): Promise<number> {
  const batch = toBatchMessages(messages);
  if (batch.length === 0) return 0;
  try {
    await client.rememberMany(batch, {
      infer: config.infer,
      scopes: config.writeScope,
    });
    return batch.length;
  } catch (err) {
    log?.warn("agentMemory persist failed", err);
    return 0;
  }
}
