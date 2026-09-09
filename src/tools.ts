// The seven agent-callable tools, one per AgentMemory operation. The agent uses
// these for deliberate memory access, distinct from the automatic recall and
// persistence the hooks provide. Following memsearch's progressive pattern,
// agent_memory_recall is the semantic entry point, agent_memory_context returns
// prompt-ready text, and agent_memory_inspect drills into a specific entity.

import { Type } from "typebox";
import type { ResolvedConfig } from "./config.js";
import type { MemoryClient, ToolDefinition, ToolResult } from "./types.js";

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function fail(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Runs a tool body and turns any thrown error into an error result. */
async function guard(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`AgentMemory error: ${message}`);
  }
}

function str(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function num(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function bool(params: Record<string, unknown>, key: string): boolean {
  return params[key] === true;
}

/**
 * Builds the tool definitions. `resolve` returns the memory client lazily so
 * tools work even if the client is created after registration.
 */
export function buildTools(
  resolve: () => MemoryClient,
  config: ResolvedConfig,
): ToolDefinition[] {
  return [
    {
      name: "agent_memory_remember",
      description:
        "Store a fact or note in long-term memory. Use for durable information " +
        "worth recalling in future sessions.",
      parameters: Type.Object({
        text: Type.String({ description: "The fact or note to remember." }),
        infer: Type.Optional(
          Type.String({
            description: "Extraction mode: full (default), triples, preview, or none.",
          }),
        ),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const text = str(params, "text");
          if (text.trim() === "") return fail("text is required");
          const res = await resolve().remember(text, {
            infer: str(params, "infer") || config.infer,
            scopes: config.writeScope,
          });
          return ok(`Remembered (session ${res.sessionId}, mode ${res.mode}).`);
        }),
    },
    {
      name: "agent_memory_recall",
      description:
        "Semantic search over memory. Start here to find what is known about a " +
        "topic; returns ranked snippets.",
      parameters: Type.Object({
        query: Type.String({ description: "What to search memory for." }),
        k: Type.Optional(Type.Number({ description: "Max results (default from config)." })),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const query = str(params, "query");
          if (query.trim() === "") return fail("query is required");
          const res = await resolve().recall(query, {
            k: num(params, "k") ?? config.recallK,
            lens: config.recallLens,
          });
          const hits = res.hits ?? [];
          if (hits.length === 0) return ok("No matching memories.");
          const body = hits
            .map((h, i) => `${i + 1}. [${h.score.toFixed(3)}] ${h.text}`)
            .join("\n");
          return ok(body);
        }),
    },
    {
      name: "agent_memory_context",
      description:
        "Retrieve memory as preformatted context text ready to reason over. " +
        "Use when you want a synthesised briefing rather than raw hits.",
      parameters: Type.Object({
        query: Type.String({ description: "The topic to build context for." }),
        k: Type.Optional(Type.Number({ description: "Max supporting hits." })),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const query = str(params, "query");
          if (query.trim() === "") return fail("query is required");
          const res = await resolve().context(query, {
            k: num(params, "k") ?? config.recallK,
            lens: config.recallLens,
          });
          return ok(res.context?.trim() || "No context available.");
        }),
    },
    {
      name: "agent_memory_reflect",
      description:
        "Run an LLM synthesis pass over stored memory to answer a reflective " +
        "question. Set persist to save the resulting insights.",
      parameters: Type.Object({
        query: Type.String({ description: "The reflective question." }),
        persist: Type.Optional(
          Type.Boolean({ description: "Persist the synthesised attributes." }),
        ),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const query = str(params, "query");
          if (query.trim() === "") return fail("query is required");
          const res = await resolve().reflect(query, { persist: bool(params, "persist") });
          return ok(res.reflection?.trim() || "No reflection produced.");
        }),
    },
    {
      name: "agent_memory_forget",
      description:
        "Remove memories matching a natural-language description. Set purge to " +
        "also erase supersession history.",
      parameters: Type.Object({
        query: Type.String({ description: "Description of what to forget." }),
        purge: Type.Optional(
          Type.Boolean({ description: "Also remove history rows (irreversible)." }),
        ),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const query = str(params, "query");
          if (query.trim() === "") return fail("query is required");
          const res = await resolve().forget(query, { purge: bool(params, "purge") });
          return ok(`Forgot ${res.deleted} memory row(s).`);
        }),
    },
    {
      name: "agent_memory_upload",
      description:
        "Ingest a document into memory. Provide the text body; it is chunked, " +
        "embedded, and made searchable.",
      parameters: Type.Object({
        text: Type.String({ description: "Document body to ingest." }),
        title: Type.Optional(Type.String({ description: "Document title." })),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const text = str(params, "text");
          if (text.trim() === "") return fail("text is required");
          const title = str(params, "title") || "untitled";
          await resolve().documents.upload({
            file: new TextEncoder().encode(text),
            filename: `${title}.md`,
            title,
            source: "openclaw-tool",
            scopes: config.writeScope,
          });
          return ok(`Uploaded "${title}".`);
        }),
    },
    {
      name: "agent_memory_inspect",
      description:
        "Inspect a specific memory reference. Ref grammar: entity:<type>/<name>, " +
        "attribute:<type>/<name>/<key>, relation:..., passage:<doc>/<i>, trace:<id>.",
      parameters: Type.Object({
        ref: Type.String({ description: "The reference to resolve." }),
      }),
      execute: (_id, params) =>
        guard(async () => {
          const ref = str(params, "ref");
          if (ref.trim() === "") return fail("ref is required");
          const res = await resolve().inspect(ref);
          return ok(JSON.stringify(res, null, 2));
        }),
    },
  ];
}
