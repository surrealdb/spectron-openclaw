// Type surfaces this plugin depends on.
//
// Two things live here:
//  1. MemoryClient: the narrow slice of the @surrealdb/memory client that the
//     hooks, tools, and CLI actually use. Depending on this slice (rather than
//     the full Agent Memory class) keeps the memory logic decoupled from the SDK
//     and lets tests inject a fake.
//  2. The OpenClaw plugin API shapes we register against. OpenClaw is a
//     peerDependency provided by the gateway at runtime, so its types are not
//     guaranteed to be installed while we build or test this package in
//     isolation. The shapes below are the documented subset we rely on; the
//     runtime object always comes from OpenClaw itself. Reconcile against the
//     installed openclaw version if the SDK drifts.

// Response and message types are indexed out of the exported `components`
// interface. The generated SDK declares the individual *Json aliases locally
// (not exported), but `components` and `Scope` are exported, so this is the
// stable way to reference them.
import type { Scope, components } from "@surrealdb/memory";

type FactsResponseJson = components["schemas"]["FactsResponseJson"];
type FactsBatchResponseJson = components["schemas"]["FactsBatchResponseJson"];
type QueryMemoryResponseJson = components["schemas"]["QueryMemoryResponseJson"];
type ContextQueryResponseJson = components["schemas"]["ContextQueryResponseJson"];
type ReflectResponseJson = components["schemas"]["ReflectResponseJson"];
type ConsolidateResponseJson = components["schemas"]["ConsolidateResponseJson"];
type InspectResponseJson = components["schemas"]["InspectResponseJson"];
type StateResponseJson = components["schemas"]["StateResponseJson"];
type WhoamiResponseJson = components["schemas"]["WhoamiJson"];
type ForgetResponseJson = components["schemas"]["ForgetResponseJson"];
type BatchMessage = components["schemas"]["BatchMessage"];

export type { Scope, BatchMessage };

/** Upload arguments we pass through to Agent Memory's documents.upload. */
export interface UploadArgs {
  file: Uint8Array | ArrayBuffer | Blob;
  filename?: string;
  title?: string;
  source?: string;
  scopes?: Scope;
  labels?: string[];
}

/**
 * The subset of the Agent Memory client the plugin uses. Mirrors the real method
 * signatures from @surrealdb/memory so the concrete client satisfies it
 * structurally.
 */
export interface MemoryClient {
  health(): Promise<void>;
  remember(
    text?: string,
    options?: {
      infer?: string;
      sessionId?: string;
      scopes?: Scope;
      role?: string;
      labels?: string[];
    },
  ): Promise<FactsResponseJson>;
  rememberMany(
    messages: BatchMessage[],
    options?: { sessionId?: string; scopes?: Scope; infer?: string; labels?: string[] },
  ): Promise<FactsBatchResponseJson>;
  recall(
    query: string,
    options?: { k?: number; mode?: string; lens?: Scope; labels?: string[] },
  ): Promise<QueryMemoryResponseJson>;
  context(
    query: string,
    options?: { k?: number; labels?: string[]; lens?: Scope },
  ): Promise<ContextQueryResponseJson>;
  reflect(query: string, options?: { persist?: boolean }): Promise<ReflectResponseJson>;
  consolidate(options?: {
    dryRun?: boolean;
    factLimit?: number;
    observationLimit?: number;
  }): Promise<ConsolidateResponseJson>;
  forget(query: string, options?: { purge?: boolean }): Promise<ForgetResponseJson>;
  inspect(ref: string): Promise<InspectResponseJson>;
  state(): Promise<StateResponseJson>;
  whoami(): Promise<WhoamiResponseJson>;
  documents: { upload(args: UploadArgs): Promise<unknown> };
  onBehalfOf(principalId: string): MemoryClient;
}

// ---------------------------------------------------------------------------
// OpenClaw plugin API subset
// ---------------------------------------------------------------------------

/** Result content block returned by an agent tool (MCP style). */
export interface ToolContent {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/** A tool the agent can call. `parameters` is a TypeBox schema object. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: unknown;
  execute(id: string, params: Record<string, unknown>): Promise<ToolResult>;
}

/** Value a before_prompt_build handler can return to inject context. */
export interface PromptBuildResult {
  prependContext?: string;
  appendContext?: string;
  prependSystemContext?: string;
}

/** Logger surface exposed on the plugin api. */
export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug?(message: string, ...args: unknown[]): void;
}

/**
 * The register(api) argument. Only the members this plugin touches are typed;
 * everything else on the real object is ignored. Members are optional so the
 * plugin can feature-detect and stay resilient across OpenClaw versions.
 */
export interface OpenClawPluginApi {
  id: string;
  name?: string;
  version?: string;
  logger?: PluginLogger;
  /** Raw config from plugins.entries.<id>.config. */
  pluginConfig?: Record<string, unknown>;
  /** Hook permission flags from plugins.entries.<id>.hooks. */
  hooks?: Record<string, unknown>;
  /** Resolve a workspace-relative path. */
  resolvePath?(...segments: string[]): string;
  /** Register a lifecycle hook handler. */
  on?(event: string, handler: (payload: any) => unknown): void;
  registerHook?(event: string, handler: (payload: any) => unknown): void;
  /** Register an agent-callable tool. */
  registerTool?(tool: ToolDefinition, opts?: { optional?: boolean }): void;
  /** Register CLI commands under `openclaw <name>`. */
  registerCli?(registrar: unknown, opts?: unknown): void;
}

export interface PluginEntry {
  id: string;
  name: string;
  description: string;
  kind?: string;
  register(api: OpenClawPluginApi): void | Promise<void>;
}
