// Ambient declaration for the OpenClaw plugin SDK entry helper.
//
// OpenClaw is a peerDependency the gateway supplies at runtime, so it is not
// installed while this package builds or tests on its own. This declaration
// lets `import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"`
// resolve for the type checker. At runtime the real module is used. tsup keeps
// "openclaw" external so the import is preserved in the built output.

declare module "openclaw/plugin-sdk/plugin-entry" {
  // Generic passthrough: the real helper validates and returns the entry as-is.
  // Kept generic so this ambient stub does not need to import project types
  // (relative imports inside `declare module` are unreliable). The plugin's
  // register(api) argument is annotated explicitly in index.ts.
  export function definePluginEntry<T>(entry: T): T;
}
