const capability = (name, write) => ({
  path: `src/lib/capabilities/pure-probe/api/${name}.ts`,
  write
});

const procedure = (name, write) => ({
  path: `src/lib/app-views/categories/pure-probe/procedures/${name}.ts`,
  write
});

const model = (name, path, write) => ({
  path: `src/lib/model/client/${name}/${path}`,
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
  },
  {
    check: "pure-island-exports-are-closed",
    subject: "lazy-singleton",
    says: "an exported function cannot hide a lazy singleton",
    names: "pure-probe/procedures/lazy-singleton.ts",
    changes: [procedure("lazy-singleton", `let held: { value: string } | undefined;\nexport const singleton = (): { value: string } => held ??= { value: "held" };\n`)]
  },
  {
    check: "pure-island-exports-are-closed",
    subject: "mutable-export",
    says: "an exported const array remains mutable",
    names: "pure-probe/procedures/mutable-array.ts",
    changes: [procedure("mutable-array", `export const values = ["one", "two"] as const;\n`)]
  },
  {
    check: "pure-island-exports-are-closed",
    subject: "live-export",
    says: "a frozen object with a function member is still a callable facade",
    names: "pure-probe/procedures/callable-facade.ts",
    changes: [procedure("callable-facade", `export const facade = Object.freeze({ run: (): string => "run" });\n`)]
  },
  {
    check: "pure-island-exports-are-closed",
    subject: "live-export",
    says: "a class instance cannot leave a pure island",
    names: "pure-probe/procedures/class-instance.ts",
    changes: [procedure("class-instance", `class Instance { readonly value = "held"; }\nexport const instance = new Instance();\n`)]
  },
  {
    check: "pure-island-exports-are-closed",
    subject: "live-export",
    says: "a promise cannot be retained and exported",
    names: "pure-probe/procedures/promise.ts",
    changes: [procedure("promise", `export const pending = Promise.resolve("held");\n`)]
  },
  {
    check: "pure-island-exports-are-closed",
    says: "a computed symbol key is not deeply immutable plain data",
    names: "pure-probe/procedures/symbol-key.ts",
    changes: [procedure("symbol-key", `const hidden = Symbol("hidden");\nexport const value = Object.freeze({ [hidden]: "held" });\n`)]
  },
  {
    check: "model-state-is-fields",
    subject: "state-file",
    says: "a model cannot omit its explicit state file",
    names: "model/client/state-missing",
    changes: [model("state-missing", "methods/read.ts", `export const read = (): string => "missing";\n`)]
  },
  {
    check: "model-state-is-fields",
    subject: "state-shape",
    says: "a getter is behavior rather than a stored body field",
    names: "state-getter/state.ts",
    changes: [model("state-getter", "state.ts", `export class StateGetterState { get body(): string { return "hidden"; } }\nexport const createStateGetterState = (): StateGetterState => new StateGetterState();\n`)]
  },
  {
    check: "model-state-is-fields",
    subject: "fields-only",
    says: "a state contract cannot declare a method",
    names: "state-method/state.ts",
    changes: [model("state-method", "state.ts", `export type StateMethodState = { body: string; getBody(): string };\nexport const createStateMethodState = (): StateMethodState => ({ body: "stored", getBody: () => "hidden" });\n`)]
  },
  {
    check: "model-state-is-fields",
    subject: "fields-only",
    says: "a state contract cannot store a callable field",
    names: "state-callable/state.ts",
    changes: [model("state-callable", "state.ts", `export type StateCallableState = { body: string; read: () => string };\nexport const createStateCallableState = (): StateCallableState => ({ body: "stored", read: () => "hidden" });\n`)]
  },
  {
    check: "model-state-is-fields",
    subject: "fields-only",
    says: "a state contract cannot inherit behavior or fields",
    names: "state-inherited/state.ts",
    changes: [model("state-inherited", "state.ts", `type Base = { body: string };\nexport interface StateInheritedState extends Base { revision: number }\nexport const createStateInheritedState = (): StateInheritedState => ({ body: "stored", revision: 1 });\n`)]
  },
  {
    check: "model-state-is-fields",
    subject: "state-shape",
    says: "a Proxy cannot hide model state behavior",
    names: "state-proxy/state.ts",
    changes: [model("state-proxy", "state.ts", `export type StateProxyState = { body: string };\nexport const createStateProxyState = (): StateProxyState => new Proxy({ body: "stored" }, {});\n`)]
  },
  {
    check: "model-operations-are-free",
    subject: "state-first",
    says: "a stateful operation cannot place caller data before state",
    names: "operation-order/methods/write.ts",
    changes: [
      model("operation-order", "state.ts", `export type OperationOrderState = { body: string };\nexport const createOperationOrderState = (): OperationOrderState => ({ body: "stored" });\n`),
      model("operation-order", "methods/write.ts", `import type { OperationOrderState } from "../state";\nexport const write = (body: string, state: OperationOrderState): void => { state.body = body; };\n`)
    ]
  },
  {
    check: "model-operations-are-free",
    subject: "free-function",
    says: "a model method cannot be attached to a class",
    names: "operation-class/methods/read.ts",
    changes: [model("operation-class", "methods/read.ts", `export class Reader { read(): string { return "hidden"; } }\n`)]
  },
  {
    check: "model-operations-are-free",
    subject: "state-access",
    says: "a model method cannot import its outer port",
    names: "operation-port/methods/read.ts",
    changes: [
      model("operation-port", "methods/read.ts", `import { acquire } from "../port";\nexport const read = (): unknown => acquire();\n`),
      model("operation-port", "port.ts", `export const acquire = (): unknown => ({});\n`)
    ]
  },
  {
    check: "model-operations-are-free",
    subject: "state-access",
    says: "an operation cannot construct another model state",
    names: "operation-construct/methods/rebuild.ts",
    changes: [
      model("operation-construct", "state.ts", `export type OperationConstructState = { body: string };\nexport const createOperationConstructState = (): OperationConstructState => ({ body: "stored" });\n`),
      model("operation-construct", "methods/rebuild.ts", `import { createOperationConstructState } from "../state";\nexport const rebuild = (): OperationConstructState => createOperationConstructState();\nimport type { OperationConstructState } from "../state";\n`)
    ]
  },
  {
    check: "model-port-has-one-lifecycle",
    subject: "acquired-port",
    says: "an acquired port cannot expose release",
    names: "lease-probe/port.ts",
    changes: [
      model("lease-probe", "state.ts", `export type LeaseProbeState = { body: string };\nexport const createLeaseProbeState = (): LeaseProbeState => ({ body: "ready" });\n`),
      model("lease-probe", "methods/read.ts", `import type { LeaseProbeState } from "../state";\nexport const read = (state: LeaseProbeState): string => state.body;\n`),
      model("lease-probe", "port.ts", `import { read } from "./methods/read";\nimport type { LeaseProbeState } from "./state";\nexport const bindLeaseProbe = (state: LeaseProbeState) => ({\n  lifetime: "client-workspace",\n  commitMode: "read-only",\n  acquire: () => Object.freeze({ read: () => read(state), commit: () => {}, release: () => {} }),\n  release: () => {}\n});\n`)
    ]
  },
  {
    check: "runtime-alone-builds-models",
    subject: "construction",
    says: "component code cannot construct model state",
    names: "pure-runtime/procedures/build-model.ts",
    changes: [
      model("runtime-probe", "state.ts", `export type RuntimeProbeState = { body: string };\nexport const createRuntimeProbeState = (): RuntimeProbeState => ({ body: "ready" });\n`),
      model("runtime-probe", "port.ts", `import type { RuntimeProbeState } from "./state";\nexport const bindRuntimeProbe = (state: RuntimeProbeState) => ({ lifetime: "client-workspace", commitMode: "read-only", acquire: () => Object.freeze({ commit: () => {} }), release: () => {} });\n`),
      {
        path: "src/lib/app-views/categories/pure-runtime/procedures/build-model.ts",
        write: `import { createRuntimeProbeState } from "$model/client/runtime-probe/state";\nexport const buildModel = () => createRuntimeProbeState();\n`
      }
    ]
  },
  {
    check: "capability-contract-is-local",
    subject: "signature",
    says: "a capability entry cannot collapse its three categories into one bag",
    names: "contract-probe/api/run/run.ts",
    changes: [{
      path: "src/lib/capabilities/contract-probe/api/run/run.ts",
      write: `export const run = (services: unknown): unknown => services;\n`
    }]
  },
  {
    check: "capability-adapter-is-exact",
    subject: "escape",
    says: "a transformer cannot spread the acquired model collection",
    names: "smuggle.server.ts",
    changes: [{
      path: "src/lib/runtime/server/capabilities/adapters/smuggle.server.ts",
      write: `export const smuggleAdapter = Object.freeze({\n  models: [] as const,\n  bindings: Object.freeze({ "run": ["store", "read"] as const }),\n  context: () => Object.freeze({}),\n  ports: (models: {}) => Object.freeze({ ...models })\n});\n`
    }]
  },
  {
    check: "capability-registry-is-bijective",
    subject: "completeness",
    says: "a registry record cannot exist without a capability operation",
    names: "registry.server.ts",
    changes: [{
      path: "src/lib/runtime/server/capabilities/registry.server.ts",
      write: `const missing = () => {};\nexport const capabilityRegistry = Object.freeze({\n  "orphan.operation": Object.freeze({ owner: "orphan", kind: "internal", scope: "system", admit: missing, entry: missing, transformer: missing, models: [], commit: "automatic" })\n});\n`
    }]
  },
  {
    check: "remote-gateway-is-the-only-crossing",
    subject: "remote",
    says: "a capability-local remote module creates a second crossing",
    names: "gateway-probe/index.remote.ts",
    changes: [{
      path: "src/lib/capabilities/gateway-probe/index.remote.ts",
      write: `export const bypass = async (input: unknown): Promise<unknown> => input;\n`
    }]
  },
  {
    check: "gateway-releases-every-acquisition",
    subject: "release",
    says: "the gateway runner cannot omit finally cleanup",
    names: "invoke.server.ts",
    changes: [{
      path: "src/lib/runtime/server/capabilities/invoke.server.ts",
      write: `export const invokeCapability = async (adapter: { acquire(): Promise<unknown> }): Promise<unknown> => {\n  const acquired = await adapter.acquire();\n  return acquired;\n};\n`
    }]
  },
  {
    check: "one-staged-commit-owner",
    subject: "duplicate",
    says: "one invocation cannot acquire a model twice",
    names: "registry.server.ts",
    changes: [{
      path: "src/lib/runtime/server/capabilities/registry.server.ts",
      write: `const missing = () => {};\nexport const capabilityRegistry = Object.freeze({\n  "probe.run": Object.freeze({ owner: "probe", kind: "internal", scope: "system", admit: missing, entry: missing, transformer: missing, models: ["store", "store"], commit: "automatic" })\n});\n`
    }]
  },
  {
    check: "component-procedures-are-closed",
    subject: "lifecycle",
    says: "a pure component procedure cannot acquire a port",
    names: "pure-lifecycle/procedures/acquire.ts",
    changes: [{
      path: "src/lib/app-views/categories/pure-lifecycle/procedures/acquire.ts",
      write: `type Adapter = { acquire(): unknown };\nexport const acquire = (adapter: Adapter): unknown => adapter.acquire();\n`
    }]
  },
  {
    check: "effects-are-boundaries",
    subject: "grammar",
    says: "an effect cannot contain a domain loop",
    names: "pure-effect/effects/loop.svelte.ts",
    changes: [
      {
        path: "src/lib/app-views/categories/pure-effect/procedures/step.ts",
        write: `export const step = (value: number): number => value + 1;\n`
      },
      {
        path: "src/lib/app-views/categories/pure-effect/effects/loop.svelte.ts",
        write: `export const loop = (): void => { $effect(() => { for (const value of [1, 2]) { void value; } }); };\n`
      }
    ]
  },
  {
    check: "pure-generators-produce-the-contract",
    subject: "closure",
    says: "the capability generator cannot add a model dependency to production",
    names: "generation/capabilities/new-procedure.mjs",
    changes: [{
      path: "scripts/generation/capabilities/new-procedure.mjs",
      write: `plan.create(join(directory, procedure), \`import type { StoreState } from "$model/server/store/types";\nexport const run = (context, ports, input) => input;\`);\n`
    }]
  }
];

export const PROOF_MUTATIONS = [
  ...new Map(MUTATIONS.map((mutation) => [mutation.check, mutation])).values()
];
