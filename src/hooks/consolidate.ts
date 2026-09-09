// session_end: run a synthesis pass so the session's accumulated turns settle
// into durable structure. Gated by autoConsolidate.
//
// consolidate() pools recent facts into observations without needing a query,
// which fits an end-of-session sweep. reflect() is available for a query-driven
// synthesis and is exposed through the tool and CLI instead.

import type { ResolvedConfig } from "../config.js";
import type { MemoryClient } from "../types.js";

/**
 * Consolidates recent memory for the context. Returns the number of durable
 * facts created, or 0 on failure. Errors are swallowed and logged so a failed
 * sweep never blocks session teardown.
 */
export async function consolidateSession(
  client: MemoryClient,
  config: ResolvedConfig,
  log?: { warn(msg: string, ...a: unknown[]): void },
): Promise<number> {
  if (!config.autoConsolidate) return 0;
  try {
    const res = await client.consolidate();
    return res?.created ?? 0;
  } catch (err) {
    log?.warn("agentMemory consolidate failed", err);
    return 0;
  }
}
