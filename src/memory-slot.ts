// Optional memory-slot takeover.
//
// OpenClaw treats memory as an exclusive "slot": one plugin owns it, selected
// by plugins.slots.memory. By default this plugin augments the built-in
// memory-core (hooks + tools, slot untouched). Takeover is opt-in and claims
// the slot so AgentMemory becomes the sole memory provider.
//
// EXPERIMENTAL: the slot ownership contract (declaring kind:"memory" and
// setting plugins.slots.memory) is inferred from OpenClaw docs and issues, not
// confirmed against a pinned release. Verify against the installed openclaw's
// plugin registry before relying on takeover in production.

export const PLUGIN_ID = "agentMemory";

/** The config patch that makes this plugin own the memory slot. */
export function takeoverConfigPatch(): {
  plugins: { slots: { memory: string } };
} {
  return { plugins: { slots: { memory: PLUGIN_ID } } };
}

/**
 * Human-readable description of the current slot arrangement, for the CLI
 * status output.
 */
export function describeSlotMode(currentSlot: unknown): string {
  if (currentSlot === PLUGIN_ID) {
    return "takeover (AgentMemory owns the memory slot; memory-core is inactive)";
  }
  if (typeof currentSlot === "string" && currentSlot !== "") {
    return `augment (memory slot owned by "${currentSlot}"; AgentMemory runs via hooks + tools)`;
  }
  return "augment (built-in memory active; AgentMemory runs via hooks + tools)";
}
