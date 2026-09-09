// Coerces scope values arriving from JSON config into the Scope shape the
// AgentMemory SDK accepts.
//
// AgentMemory scopes are a DNF selector (string[][]): an OR of clauses, each an
// AND of "key/value" slash paths. The SDK also accepts a bare string and a
// flat string array as shorthands and normalises them internally, so this
// helper only needs to pass valid shapes through and drop empty ones.

import type { Scope } from "./types.js";

/**
 * Accepts what config JSON can hold (a string, a string array, or a nested
 * array of paths) and returns a Scope, or undefined when nothing usable is
 * present so callers can omit the field and fall back to the key's default
 * region.
 */
export function coerceScope(input: unknown): Scope {
  if (input == null) return undefined;

  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (Array.isArray(input)) {
    const clauses: Array<string | string[]> = [];
    for (const clause of input) {
      if (typeof clause === "string") {
        const trimmed = clause.trim();
        if (trimmed !== "") clauses.push(trimmed);
      } else if (Array.isArray(clause)) {
        const paths = clause
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.trim())
          .filter((p) => p !== "");
        if (paths.length > 0) clauses.push(paths);
      }
    }
    return clauses.length > 0 ? clauses : undefined;
  }

  return undefined;
}
