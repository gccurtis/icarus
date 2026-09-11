const capability = (name, write) => ({
  path: `src/lib/capabilities/pure-probe/api/${name}.ts`,
  write
});

const procedure = (name, write) => ({
  path: `src/lib/app-views/categories/pure-probe/procedures/${name}.ts`,
  write
});

export const MUTATIONS = [
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "a capability imports a runtime value directly",
    names: "pure-probe/api/direct-import.ts",
    changes: [capability("direct-import", `import { serverModel } from "$runtime/server/start.server";\nexport const read = (): unknown => serverModel();\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "a type-only import leaves its capability",
    names: "pure-probe/api/type-import.ts",
    changes: [capability("type-import", `import type { ServerModel } from "$runtime/server/types";\nexport type Leaked = ServerModel;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "an export-from edge leaves its capability",
    names: "pure-probe/api/export-from.ts",
    changes: [capability("export-from", `export { serverModel } from "$runtime/server/start.server";\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "an in-island barrel launders an outside dependency",
    names: "pure-probe/api/shared/launder.ts",
    changes: [
      capability("entry", `import { leak } from "./shared/launder";\nexport const entry = (): unknown => leak();\n`),
      capability("shared/launder", `export { serverModel as leak } from "$runtime/server/start.server";\n`)
    ]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "two local hops cannot launder an outside dependency",
    names: "pure-probe/api/shared/second.ts",
    changes: [
      capability("two-hop", `import { leak } from "./shared/first";\nexport const entry = (): unknown => leak();\n`),
      capability("shared/first", `export { leak } from "./second";\n`),
      capability("shared/second", `export { serverModel as leak } from "$runtime/server/start.server";\n`)
    ]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "the broad lib alias cannot disguise a runtime dependency",
    names: "pure-probe/api/alias-launder.ts",
    changes: [capability("alias-launder", `export { serverModel } from "$lib/runtime/server/start.server";\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "relative traversal cannot leave a capability",
    names: "pure-probe/api/relative-traversal.ts",
    changes: [capability("relative-traversal", `export { serverModel } from "../../../runtime/server/start.server";\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "a package import is outside every pure island",
    names: "pure-probe/api/package-import.ts",
    changes: [capability("package-import", `import { z } from "zod";\nexport const schema = z.string();\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dynamic-load",
    says: "a literal dynamic import is forbidden even within an island",
    names: "pure-probe/api/dynamic-import.ts",
    changes: [capability("dynamic-import", `export const load = async (): Promise<unknown> => import("./dynamic-local");\n`), capability("dynamic-local", `export const value = 1;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dynamic-load",
    says: "require cannot hide a dependency",
    names: "pure-probe/api/require.ts",
    changes: [capability("require", `export const load = (): unknown => require("./required-local");\n`), capability("required-local", `export const value = 1;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dynamic-load",
    says: "an import-type query cannot bypass the graph",
    names: "pure-probe/api/import-type.ts",
    changes: [capability("import-type", `export type Leaked = import("$runtime/server/types").ServerModel;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "ambient-type",
    says: "typeof an ambient value is an outside type dependency",
    names: "pure-probe/api/typeof-window.ts",
    changes: [capability("typeof-window", `export type WindowAuthority = typeof window;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "ambient-type",
    says: "a DOM type is not pure-island vocabulary",
    names: "pure-probe/api/dom-type.ts",
    changes: [capability("dom-type", `export const tag = (node: HTMLElement): string => node.tagName;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "ambient-declaration",
    says: "a pure file cannot augment the global namespace",
    names: "pure-probe/api/augment.ts",
    changes: [capability("augment", `export {};\ndeclare global { interface Window { leaked: string } }\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dynamic-load",
    says: "a triple-slash path cannot load declarations",
    names: "pure-probe/api/triple-slash.ts",
    changes: [capability("triple-slash", `/// <reference path="../../../runtime/server/types.ts" />\nexport type Local = string;\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "unsupported-source",
    says: "a Svelte rune module cannot implement an island function",
    names: "pure-probe/api/rune.svelte.ts",
    changes: [capability("rune.svelte", `export const value = $state(0);\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "unresolved-dependency",
    says: "an unresolved edge fails closed",
    names: "pure-probe/api/unresolved.ts",
    changes: [capability("unresolved", `export { missing } from "./does-not-exist";\n`)]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "production cannot import its capability tests",
    names: "pure-probe/api/test-edge.ts",
    changes: [
      capability("test-edge", `export { fixture } from "../test/unit/fixture";\n`),
      { path: "src/lib/capabilities/pure-probe/test/unit/fixture.ts", write: `export const fixture = "test-only";\n` }
    ]
  },
  {
    check: "pure-island-import-closure",
    subject: "dependency-escape",
    says: "a model state file cannot transitively import representation vocabulary",
    names: "model/client/pure-probe/state.ts",
    changes: [
      { path: "src/lib/model/client/pure-probe/methods/read.ts", write: `import type { ProbeState } from "../state";\nexport const read = (state: ProbeState): string => state.value;\n` },
      { path: "src/lib/model/client/pure-probe/state.ts", write: `import type { Id } from "$representation/data/types/core/id";\nexport type ProbeState = { value: Id<"projects"> };\n` },
      { path: "src/lib/model/client/pure-probe/types.ts", write: `export type Local = string;\n` }
    ]
  },
  {
    check: "pure-island-import-closure",
    subject: "symlink-escape",
    says: "a symlink cannot make an outside runtime file look capability-local",
    names: "pure-probe/api/symlinked.ts",
    changes: [
      { path: "src/lib/runtime/symlink-target.ts", write: `export const hiddenRuntime = 1;\n` },
      { path: "src/lib/capabilities/pure-probe/api/symlinked.ts", link: "src/lib/runtime/symlink-target.ts" }
    ]
  },

  {
    check: "pure-island-has-no-ambient-authority",
    subject: "ambient-authority",
    says: "a pure procedure reads the ambient clock",
    names: "pure-probe/procedures/clock.ts",
    changes: [procedure("clock", `export const clock = (): number => Date.now();\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "ambient-authority",
    says: "lexical shadowing does not hide a nested ambient read",
    names: "pure-probe/procedures/shadow.ts",
    changes: [procedure("shadow", `export const read = (window: { value: string }): string => {\n  const local = window.value;\n  const nested = (): string => document.title;\n  return local + nested();\n};\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "ambient-authority",
    says: "renaming a global does not change its provenance",
    names: "pure-probe/procedures/aliased-global.ts",
    changes: [procedure("aliased-global", `const clock = Date;\nexport const now = (): number => clock.now();\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "ambient-authority",
    says: "computed global access is ambient authority",
    names: "pure-probe/procedures/computed-global.ts",
    changes: [procedure("computed-global", `export const read = (key: string): unknown => globalThis[key];\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "module-state",
    says: "a mutable module cache persists across calls",
    names: "pure-probe/procedures/cache.ts",
    changes: [procedure("cache", `let cached = 0;\nexport const next = (): number => ++cached;\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "module-state",
    says: "const does not make a module Map immutable",
    names: "pure-probe/procedures/const-map.ts",
    changes: [procedure("const-map", `const cache = new Map<string, string>();\nexport const save = (key: string): void => { cache.set(key, key); };\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "attached-behavior",
    says: "a getter hides a procedure call behind field syntax",
    names: "pure-probe/procedures/getter.ts",
    changes: [procedure("getter", `export class Hidden { get body(): string { return "hidden"; } }\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "dynamic-evaluation",
    says: "computed dynamic imports acquire undeclared code",
    names: "pure-probe/procedures/computed-import.ts",
    changes: [procedure("computed-import", `export const load = (name: string): Promise<unknown> => import(name);\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "unsafe-narrowing",
    says: "a cast cannot narrow a broad service to a port",
    names: "pure-probe/procedures/cast.ts",
    changes: [procedure("cast", `type Port = { write(value: string): void };\nexport const save = (value: object): void => { (value as Port).write("x"); };\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "broad-authority",
    says: "an unconstrained generic helper can launder a port",
    names: "pure-probe/procedures/generic.ts",
    changes: [procedure("generic", `export const pass = <T>(value: T): T => value;\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "detached-work",
    says: "a promise-returning port call cannot float past return",
    names: "pure-probe/procedures/floating.ts",
    changes: [procedure("floating", `type Port = { write(value: string): Promise<void> };\nexport const save = (port: Port): void => { port.write("x"); };\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "detached-work",
    says: "a returned closure cannot retain a supplied port",
    names: "pure-probe/procedures/escaping-closure.ts",
    changes: [procedure("escaping-closure", `type Port = { write(value: string): void };\nexport const later = (port: Port): (() => void) => () => port.write("late");\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "await-origin",
    says: "a promise passed as data is not an acquired port operation",
    names: "pure-probe/procedures/await-data.ts",
    changes: [procedure("await-data", `export const wait = async (work: Promise<void>): Promise<void> => { await work; };\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "port-introspection",
    says: "a computed key can select undeclared port authority",
    names: "pure-probe/procedures/computed-port.ts",
    changes: [procedure("computed-port", `type Port = { read(): string; write(value: string): void };\nexport const invoke = (port: Port, key: "read"): unknown => port[key]();\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "port-introspection",
    says: "enumerating a port exposes its authority surface",
    names: "pure-probe/procedures/enumerate-port.ts",
    changes: [procedure("enumerate-port", `type Port = { read(): string };\nexport const names = (port: Port): string[] => Object.keys(port);\n`)]
  },
  {
    check: "pure-island-has-no-ambient-authority",
    subject: "port-introspection",
    says: "Function.call cannot rebind a port member",
    names: "pure-probe/procedures/call-port.ts",
    changes: [procedure("call-port", `type Port = { read(): string };\nexport const read = (port: Port): string => port.read.call(null);\n`)]
  }
];

export const PROOF_MUTATIONS = [
  MUTATIONS.find(({ check }) => check === "pure-island-import-closure"),
  MUTATIONS.find(({ check }) => check === "pure-island-has-no-ambient-authority")
];
