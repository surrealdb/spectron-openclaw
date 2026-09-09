// Normalises OpenClaw conversation turns into AgentMemory batch messages.
//
// OpenClaw messages carry platform metadata (channel/conversation info, sender
// headers, thread context, forwarded-message wrappers) that should not be
// persisted as memory. We keep only the role and the text content, which drops
// that metadata by construction. Content can arrive as a plain string or as an
// array of content blocks; both are handled.

import type { BatchMessage } from "./types.js";

/** A loose view of an OpenClaw message. Only the fields we read are named. */
export interface RawMessage {
  role?: unknown;
  content?: unknown;
  text?: unknown;
  ts?: unknown;
  timestamp?: unknown;
}

type Role = BatchMessage["role"];

function normaliseRole(role: unknown): Role {
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
    return role;
  }
  // OpenClaw sometimes labels the agent side "ai" or "model"; fold those in.
  if (role === "ai" || role === "model" || role === "agent") return "assistant";
  if (role === "human") return "user";
  return "user";
}

/** Extracts plain text from string content or an array of content blocks. */
function extractText(message: RawMessage): string {
  if (typeof message.content === "string") return message.content.trim();
  if (typeof message.text === "string") return message.text.trim();

  if (Array.isArray(message.content)) {
    const parts: string[] = [];
    for (const block of message.content) {
      if (typeof block === "string") {
        parts.push(block);
      } else if (block && typeof block === "object") {
        const text = (block as { text?: unknown }).text;
        if (typeof text === "string") parts.push(text);
      }
    }
    return parts.join("\n").trim();
  }

  return "";
}

function extractTs(message: RawMessage): string | undefined {
  const raw = message.ts ?? message.timestamp;
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}

/**
 * Converts OpenClaw messages to AgentMemory batch messages, dropping empties.
 * Returns an empty array when there is nothing worth persisting.
 */
export function toBatchMessages(messages: readonly RawMessage[] | undefined): BatchMessage[] {
  if (!Array.isArray(messages)) return [];
  const out: BatchMessage[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const content = extractText(message);
    if (content === "") continue;
    const ts = extractTs(message);
    const batch: BatchMessage = { role: normaliseRole(message.role), content };
    if (ts) batch.ts = ts;
    out.push(batch);
  }
  return out;
}
