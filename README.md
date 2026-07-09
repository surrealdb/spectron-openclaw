# @surrealdb/spectron-openclaw

OpenClaw plugin that backs agent memory with [SurrealDB Spectron](https://surrealdb.com/platform/spectron).

It gives an [OpenClaw](https://docs.openclaw.ai/) agent long-term memory that survives session restarts and fresh chats: relevant memory is recalled before each turn, each turn is persisted afterwards, and the agent gets tools and a CLI for deliberate memory access. Spectron stores memory, knowledge graphs, and documents in one ACID context, so what the agent learns stays consistent.

## How it works

The plugin maps Spectron's operations onto OpenClaw's agent lifecycle:

| Spectron | OpenClaw hook | What happens | Gated by |
| --- | --- | --- | --- |
| `context` / `recall` | `before_prompt_build` | Relevant memory is injected as `<spectron_memory>` before the model runs | `autoRecall` + `hooks.allowPromptInjection` |
| `rememberMany` | `agent_end` | The turn is persisted (platform metadata stripped) | `autoCapture` + `hooks.allowConversationAccess` |
| `consolidate` | `session_end` | Recent facts are consolidated into durable observations | `autoConsolidate` |
| `documents.upload` | `gateway_start` + `spectron index` | Workspace memory files (`MEMORY.md`, `memory/**`) are seeded | `autoIndex` |
| `remember` / `recall` / `context` / `reflect` / `forget` / `inspect` / `upload` | agent tools | Deliberate memory access mid-conversation | always |

By default it **augments** OpenClaw's built-in memory. It can optionally **take over** the memory slot (see [Memory modes](#memory-modes)).

## Prerequisites

- OpenClaw `>= 2026.4.27` (the version where `agent_end` requires `allowConversationAccess`).
- A Spectron endpoint and API key, either SurrealDB Cloud or the self-hosted Spectron binary, plus a context id. Each context is its own SurrealDB namespace and database.

## Install

```bash
openclaw plugins install @surrealdb/spectron-openclaw
openclaw spectron setup
openclaw gateway restart
```

`openclaw spectron setup` prints the config block and the two hook flags to add. Local development install:

```bash
npm install && npm run build
openclaw plugins install -l .
```

## Configure

Configuration lives in `~/.openclaw/openclaw.json` under `plugins.entries.spectron`:

```json
{
  "plugins": {
    "entries": {
      "spectron": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true,
          "allowPromptInjection": true
        },
        "config": {
          "endpoint": "${SPECTRON_ENDPOINT}",
          "apiKey": "${SPECTRON_API_KEY}",
          "context": "${SPECTRON_CONTEXT}"
        }
      }
    }
  }
}
```

Both hook flags are required. `allowConversationAccess` lets OpenClaw deliver `agent_end` to the plugin (without it, per-turn persistence is silently skipped). `allowPromptInjection` lets the plugin inject recalled context. Connection fields accept `${ENV_VAR}` references so secrets stay out of the config file.

### Config reference (`plugins.entries.spectron.config`)

| Key | Default | Purpose |
| --- | --- | --- |
| `endpoint` | required | Spectron API origin, no trailing slash |
| `apiKey` | required | Bearer API key (`sp-...`) |
| `context` | required | Spectron context id (namespace + database) |
| `recallLens` / `recallScope` | whole region | Read lens narrowing recall (scope path, or array of paths) |
| `writeScope` | key default | Scope written memories are tagged with |
| `onBehalfOf` | (none) | Principal id for delegated calls (`X-Spectron-On-Behalf-Of`) |
| `autoRecall` | `true` | Inject memory before each turn |
| `autoCapture` | `true` | Persist each turn |
| `autoConsolidate` | `true` | Consolidate at session end |
| `autoIndex` | `true` | Seed workspace memory files on start / `index` |
| `recallK` | `5` | Max hits per recall |
| `injectMode` | `"context"` | `context` (formatted text) or `recall` (ranked hits) |
| `infer` | `"full"` | Extraction mode: `full`, `triples`, `preview`, `none` |
| `requestTimeoutMs` | `60000` | Per-request timeout |

Scopes follow Spectron's DNF syntax: a path string `"team/eng"`, an OR of paths `["a", "b"]`, or a nested AND clause `[["a", "b"]]`.

## Agent tools

The agent can call these directly:

- `spectron_recall`: semantic search over memory (start here).
- `spectron_context`: memory as prompt-ready context text.
- `spectron_remember`: store a fact or note.
- `spectron_reflect`: LLM synthesis over memory, optionally persisted.
- `spectron_forget`: remove memories matching a description.
- `spectron_upload`: ingest a document body.
- `spectron_inspect`: resolve a specific entity/attribute/relation/passage/trace ref.

## CLI

```bash
openclaw spectron setup [--takeover]   # print config + required hook flags
openclaw spectron status               # config, slot mode, and identity
openclaw spectron health               # check the connection
openclaw spectron index                # seed workspace memory files
openclaw spectron recall <query>       # search memory
openclaw spectron reflect <query>      # synthesise an answer from memory
openclaw spectron forget <query>       # forget matching memories
```

## Memory modes

- **Augment (default):** runs alongside the built-in `memory-core`. Nothing about the memory slot changes.
- **Takeover (experimental):** `openclaw spectron setup --takeover` prints a patch that sets `plugins.slots.memory` to `spectron`, making Spectron the sole memory provider. The slot ownership contract is inferred from the OpenClaw docs and is not yet verified against a pinned release, so treat takeover as experimental.

## Verification

Unit tests run without a Spectron endpoint (an in-memory fake client stands in):

```bash
npm run typecheck
npm test
npm run build
```

End-to-end against a real Spectron (requires an endpoint + key):

```bash
export SPECTRON_ENDPOINT=... SPECTRON_API_KEY=... SPECTRON_CONTEXT=...
openclaw spectron setup
openclaw spectron health          # expect: healthy
# run an agent turn, then:
openclaw spectron recall "<something the agent just discussed>"
openclaw spectron status
```

## Notes

- Built against `@surrealdb/spectron` (alpha) and the documented OpenClaw plugin API. Both are young; pin versions and re-check the hook and CLI registration surfaces if either drifts.
- Memory "types" (working, semantic, episodic, and so on) are a conceptual framing over Spectron's fact/entity/document substrate, not an API parameter. Categorisation is influenced through `infer` and scopes.

## License

Apache-2.0
