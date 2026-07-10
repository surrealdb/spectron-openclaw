# Examples

## OpenClaw config

Two ready-to-merge configs for `~/.openclaw/openclaw.json`. Merge one into your existing config (do not overwrite the whole file), then set the `SPECTRON_*` environment variables the `${...}` references resolve from.

- [`openclaw.augment.json`](openclaw.augment.json): default mode. Spectron runs alongside the built-in memory via hooks and tools, with every automatic behaviour shown explicitly.
- [`openclaw.takeover.json`](openclaw.takeover.json): experimental. Adds `plugins.slots.memory: "spectron"` so Spectron is the sole memory provider, and scopes reads and writes to `org/acme`.

Both set the two required hook flags: `allowConversationAccess` (per-turn persistence) and `allowPromptInjection` (recall injection).

## quickstart.ts

A runnable walkthrough of the Spectron operations the plugin drives, one per lifecycle stage, straight against the `@surrealdb/spectron` SDK. Use it to confirm a live endpoint works before wiring the plugin into a gateway.

```bash
export SPECTRON_ENDPOINT=... SPECTRON_API_KEY=... SPECTRON_CONTEXT=...
npx tsx examples/quickstart.ts
```

It runs health, `rememberMany`, `context`, `recall`, `reflect`, `consolidate`, and `forget`, printing what each returns. Requires a reachable Spectron endpoint (SurrealDB Cloud or the self-hosted binary).
