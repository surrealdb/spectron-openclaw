import { defineConfig } from "tsup";

// Builds the plugin entry to an ESM file that OpenClaw loads via
// package.json "openclaw.extensions". Runtime dependencies (@surrealdb/memory,
// typebox) stay external and are installed alongside the plugin as normal npm
// deps; openclaw is external because the gateway provides it at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["openclaw", "@surrealdb/memory", "typebox"],
});
