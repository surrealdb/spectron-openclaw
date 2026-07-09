// gateway_start: verify the Spectron connection early and, when autoIndex is
// on, seed the context with the workspace's local memory files (MEMORY.md and
// anything under memory/). This mirrors how the built-in memory keeps editable
// Markdown, so existing notes are searchable through Spectron too.

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ResolvedConfig } from "../config.js";
import type { MemoryClient } from "../types.js";

const SEED_ROOT_FILES = ["MEMORY.md"];
const SEED_DIRS = ["memory"];
const TEXT_EXTENSIONS = [".md", ".markdown", ".txt"];

interface Logger {
  info(msg: string, ...a: unknown[]): void;
  warn(msg: string, ...a: unknown[]): void;
}

function isTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Lists workspace memory files to seed: MEMORY.md at the root plus text files
 * under memory/ (one level deep). Missing paths are skipped quietly.
 */
export async function collectMemoryFiles(workspaceDir: string): Promise<string[]> {
  const found: string[] = [];

  for (const name of SEED_ROOT_FILES) {
    const path = join(workspaceDir, name);
    try {
      if ((await stat(path)).isFile()) found.push(path);
    } catch {
      // not present, skip
    }
  }

  for (const dir of SEED_DIRS) {
    const dirPath = join(workspaceDir, dir);
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!isTextFile(entry)) continue;
      const path = join(dirPath, entry);
      try {
        if ((await stat(path)).isFile()) found.push(path);
      } catch {
        // race or permission, skip
      }
    }
  }

  return found;
}

/**
 * Runs the health probe and, when enabled, uploads local memory files. Returns
 * a summary. A failed health check is surfaced as ok=false but does not throw,
 * so a memory outage does not stop the gateway from starting.
 */
export async function bootstrap(
  client: MemoryClient,
  config: ResolvedConfig,
  workspaceDir: string | undefined,
  log?: Logger,
): Promise<{ ok: boolean; uploaded: number }> {
  let ok = true;
  try {
    await client.health();
    log?.info("spectron: connection healthy");
  } catch (err) {
    ok = false;
    log?.warn("spectron: health check failed", err);
  }

  let uploaded = 0;
  if (ok && config.autoIndex && workspaceDir) {
    const files = await collectMemoryFiles(workspaceDir);
    for (const path of files) {
      try {
        const bytes = await readFile(path);
        await client.documents.upload({
          file: new Uint8Array(bytes),
          filename: path.split("/").pop(),
          title: path.split("/").pop(),
          source: "openclaw-workspace",
          scopes: config.writeScope,
        });
        uploaded += 1;
      } catch (err) {
        log?.warn(`spectron: upload failed for ${path}`, err);
      }
    }
    if (uploaded > 0) log?.info(`spectron: seeded ${uploaded} memory file(s)`);
  }

  return { ok, uploaded };
}
