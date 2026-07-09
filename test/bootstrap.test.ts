import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bootstrap, collectMemoryFiles } from "../src/hooks/bootstrap.js";
import { FakeSpectron } from "./fake.js";
import { makeConfig } from "./helpers.js";

const dirs: string[] = [];

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "spectron-ws-"));
  dirs.push(dir);
  await writeFile(join(dir, "MEMORY.md"), "long term notes");
  await mkdir(join(dir, "memory"));
  await writeFile(join(dir, "memory", "2026-01-01.md"), "daily note");
  await writeFile(join(dir, "memory", "ignore.bin"), "binary");
  return dir;
}

afterAll(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe("collectMemoryFiles", () => {
  it("finds MEMORY.md and text files under memory/, skipping non-text", async () => {
    const dir = await makeWorkspace();
    const files = await collectMemoryFiles(dir);
    const names = files.map((f) => f.split("/").pop()).sort();
    expect(names).toEqual(["2026-01-01.md", "MEMORY.md"]);
  });

  it("returns empty for a missing workspace", async () => {
    expect(await collectMemoryFiles("/no/such/path/xyz")).toEqual([]);
  });
});

describe("bootstrap", () => {
  it("uploads seed files when healthy and autoIndex is on", async () => {
    const dir = await makeWorkspace();
    const client = new FakeSpectron();
    const res = await bootstrap(client, makeConfig(), dir);
    expect(res.ok).toBe(true);
    expect(res.uploaded).toBe(2);
    expect(client.countOf("documents.upload")).toBe(2);
  });

  it("does not upload when autoIndex is off", async () => {
    const dir = await makeWorkspace();
    const client = new FakeSpectron();
    const res = await bootstrap(client, makeConfig({ autoIndex: false }), dir);
    expect(res.uploaded).toBe(0);
    expect(client.countOf("documents.upload")).toBe(0);
  });

  it("reports unhealthy and skips uploads when health fails", async () => {
    const dir = await makeWorkspace();
    const client = new FakeSpectron({ healthError: new Error("down") });
    const res = await bootstrap(client, makeConfig(), dir);
    expect(res.ok).toBe(false);
    expect(res.uploaded).toBe(0);
  });
});
