# Examples

## OpenClaw config

Two ready-to-merge configs for `~/.openclaw/openclaw.json`. Merge one into your existing config (do not overwrite the whole file), then set the `AGENT_MEMORY_*` environment variables the `${...}` references resolve from.

- [`openclaw.augment.json`](openclaw.augment.json): default mode. Agent Memory runs alongside the built-in memory via hooks and tools, with every automatic behaviour shown explicitly.
- [`openclaw.takeover.json`](openclaw.takeover.json): experimental. Adds `plugins.slots.memory: "agentMemory"` so Agent Memory is the sole memory provider, and scopes reads and writes to `org/acme`.

Both set the two required hook flags: `allowConversationAccess` (per-turn persistence) and `allowPromptInjection` (recall injection).

## quickstart.ts

A runnable walkthrough of the Agent Memory operations the plugin drives, one per lifecycle stage, straight against the `@surrealdb/memory` SDK. Use it to confirm a live endpoint works before wiring the plugin into a gateway.

```bash
export AGENT_MEMORY_ENDPOINT=... AGENT_MEMORY_API_KEY=... AGENT_MEMORY_CONTEXT=...
npx tsx examples/quickstart.ts
```

It runs health, `rememberMany`, `context`, `recall`, `reflect`, `consolidate`, and `forget`, printing what each returns. Requires a reachable Agent Memory endpoint (SurrealDB Cloud or the self-hosted binary).
