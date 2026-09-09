// Quickstart: the Agent Memory operations this plugin wires into OpenClaw, run
// directly against the SDK so you can see them work end to end without a
// gateway. Each step notes the OpenClaw hook it corresponds to inside the
// plugin.
//
// Run against a live Agent Memory endpoint:
//   export AGENT_MEMORY_ENDPOINT=... AGENT_MEMORY_API_KEY=... AGENT_MEMORY_CONTEXT=...
//   npx tsx examples/quickstart.ts
//
// (tsx runs TypeScript directly; any equivalent ESM TS runner works.)

import { AgentMemory } from "@surrealdb/memory";

const endpoint = process.env.AGENT_MEMORY_ENDPOINT;
const apiKey = process.env.AGENT_MEMORY_API_KEY;
const context = process.env.AGENT_MEMORY_CONTEXT;

if (!endpoint || !apiKey || !context) {
  console.error(
    "Set AGENT_MEMORY_ENDPOINT, AGENT_MEMORY_API_KEY, and AGENT_MEMORY_CONTEXT before running.",
  );
  process.exit(1);
}

const client = new AgentMemory({ endpoint, apiKey, context });

// gateway_start hook: verify the connection early.
await client.health();
console.log("health: ok");

// agent_end hook: persist a turn. rememberMany is what the plugin calls with
// the (metadata-stripped) conversation after each turn.
await client.rememberMany(
  [
    { role: "user", content: "I'm Tobie and I prefer dark mode." },
    { role: "assistant", content: "Noted, I'll keep interfaces in dark mode for you." },
  ],
  { infer: "full" },
);
console.log("remembered a turn");

// before_prompt_build hook (injectMode: "context"): fetch prompt-ready context.
const ctx = await client.context("What are the user's UI preferences?", { k: 5 });
console.log("\ncontext injection:\n" + (ctx.context || "(empty)"));

// before_prompt_build hook (injectMode: "recall"): ranked hits instead.
const recalled = await client.recall("Who is the user?", { k: 5 });
console.log("\nrecall hits:");
for (const hit of recalled.hits ?? []) {
  console.log(`  [${hit.score.toFixed(3)}] ${hit.text}`);
}

// agent_memory_reflect tool: synthesise over memory.
const reflection = await client.reflect("Summarise what you know about the user.");
console.log("\nreflection:\n" + (reflection.reflection || "(none)"));

// session_end hook: consolidate recent facts into durable observations.
const consolidated = await client.consolidate();
console.log(`\nconsolidated: ${consolidated.created} new fact(s)`);

// agent_memory_forget tool / CLI: remove matching memories.
const forgotten = await client.forget("dark mode preference", { purge: false });
console.log(`forgot: ${forgotten.deleted} row(s)`);
