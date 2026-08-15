#!/usr/bin/env node
/**
 * Writes the fixture trees the lint tests run against.
 *
 * Generated rather than committed as a hundred near-identical stub files: the
 * point of a fixture is the ONE thing wrong with it, and that is legible here and
 * invisible in a directory listing. `clean` is the compliant baseline and every
 * other fixture is `clean` plus a single deliberate defect, so a rule that fires
 * on the wrong fixture is a rule that is testing the wrong thing.
 *
 * A fixture root stands in for `src/`, not for the model tree alone. Half of these
 * rules are about the boundary between the model and everything else — a route
 * reaching the client model, a browser module reaching the server tree, a consumer
 * calling a constructor — and a fixture holding only `model/` could not express
 * any of them.
 *
 * Run by the test file itself; there is no need to invoke it directly.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const write = (root, path, contents = "") => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
};

const MODEL = "lib/model";

/** What the fixtures' `$model` and `$lib` resolve to, relative to the fixture root. */
export const ALIASES = { $model: MODEL, $lib: "lib" };

/**
 * The client door, spelled out here because three fixtures are it-with-one-thing
 * -wrong and a copy in each would let the baseline drift away from them.
 *
 * It carries the two things only a door may: the instance, and the reach for
 * `$app/*`. The accessor refuses twice, because reaching a tab's graph from the
 * server and reaching it before the layout ran are different mistakes.
 */
const CLIENT_DOOR =
  'import { browser } from "$app/environment";\n' +
  'import { buildClientModel } from "$model/client/constructor";\n' +
  'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
  "let instance: ClientModel | undefined;\n\n" +
  "/** Called once by the layout that owns this client instance. */\n" +
  "export const initClientModel = (input: ClientModelInput): ClientModel =>\n" +
  "  (instance = buildClientModel(input));\n\n" +
  "export const clientModel = (): ClientModel => {\n" +
  '  if (!browser) throw new Error("The client model is browser-only.");\n' +
  '  if (!instance) throw new Error("The client model has not been built.");\n' +
  "  return instance;\n" +
  "};\n";

/**
 * A compliant tree: two client objects, one of them reactive and one not, one
 * server object, a complex method with a nested supporting method, a promoted
 * shared method with the two callers that justify it, both environment roots, and
 * the routes that reach them.
 *
 * `storage` earns its place in the baseline by owning no reactive state. A client
 * object is not required to be reactive, and a rule demanding `.svelte.ts` of every
 * client definition would reject it — so the baseline exercises that on every run
 * rather than only in its own test.
 */
const clean = (root) => {
  const model = (path, contents) => write(root, `${MODEL}/${path}`, contents);

  model("model.md", "# The Model\n");

  // ------------------------------------------------------------- client root ----
  model("client/client.md", "# The Client Model\n");
  model("client/index.ts", CLIENT_DOOR);
  model(
    "client/types.ts",
    'import type { StorageModel } from "$model/client/storage";\n' +
      'import type { WorkbenchModel } from "$model/client/workbench";\n\n' +
      "export interface ClientModelInput {\n  readonly projectId: string;\n}\n\n" +
      "export interface ClientModel {\n" +
      "  readonly storage: StorageModel;\n" +
      "  readonly workbench: WorkbenchModel;\n" +
      "}\n"
  );
  model(
    "client/constructor.ts",
    'import { createStorage } from "$model/client/storage";\n' +
      'import { createWorkbench } from "$model/client/workbench";\n' +
      'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
      "export const buildClientModel = (input: ClientModelInput): ClientModel => {\n" +
      "  const storage = createStorage(input.projectId);\n" +
      "  return { storage, workbench: createWorkbench(storage) };\n" +
      "};\n"
  );
  model("client/test/unit/graph.test.ts", "// every aggregate field is constructed exactly once\n");

  // --------------------------------------------------------------- workbench ----
  model("client/workbench/workbench.md", "# Workbench\n");
  model(
    "client/workbench/index.ts",
    'export { createWorkbench } from "$model/client/workbench/constructor";\n' +
      'export type { Tab, WorkbenchModel } from "$model/client/workbench/types";\n'
  );
  model(
    "client/workbench/types.ts",
    "export interface Tab {\n  readonly id: string;\n  readonly kind: string;\n}\n\n" +
      "export interface WorkbenchModel {\n" +
      "  readonly tabs: readonly Tab[];\n" +
      "  open(resource: string): Tab;\n" +
      "  activate(id: string): void;\n" +
      "}\n"
  );
  // An object reaches its own internals through its own alias path; only files
  // outside it are held to the door.
  model(
    "client/workbench/definition.svelte.ts",
    'import { activate } from "$model/client/workbench/methods/activate";\n' +
      'import { open } from "$model/client/workbench/methods/open/open";\n' +
      'import type { Tab, WorkbenchModel } from "$model/client/workbench/types";\n\n' +
      "export class Workbench implements WorkbenchModel {\n" +
      "  #tabs = $state<Tab[]>([]);\n\n" +
      "  get tabs(): readonly Tab[] {\n    return this.#tabs;\n  }\n\n" +
      "  open(resource: string): Tab {\n    return open(this.#tabs, resource);\n  }\n\n" +
      "  activate(id: string): void {\n    activate(this.#tabs, id);\n  }\n" +
      "}\n"
  );
  model(
    "client/workbench/constructor.ts",
    'import { Workbench } from "$model/client/workbench/definition.svelte";\n' +
      'import type { WorkbenchModel } from "$model/client/workbench/types";\n' +
      'import type { StorageModel } from "$model/client/storage";\n\n' +
      "export const createWorkbench = (storage: StorageModel): WorkbenchModel => new Workbench(storage);\n"
  );

  model("client/workbench/methods/methods.md", "# Workbench Methods\n\n`open`, `activate`.\n");
  model(
    "client/workbench/methods/activate.ts",
    'import { touch } from "$model/client/workbench/methods/shared/touch";\n\n' +
      "export const activate = (tabs: Tab[], id: string): void => {\n  touch(tabs, id);\n};\n"
  );
  model(
    "client/workbench/methods/open/open.md",
    "# Method: `open`\n\n## Method Tree\n\n```text\nopen(tabs, resource)\n" +
      "├── touch()                 ../shared/touch.ts\n" +
      "├── canonicalResource()     canonical-resource.ts\n" +
      "└── restore()               restore/restore.ts\n" +
      "    └── validateStoredKind()  restore/validate-stored-kind.ts\n```\n"
  );
  model(
    "client/workbench/methods/open/open.ts",
    'import { canonicalResource } from "$model/client/workbench/methods/open/canonical-resource";\n' +
      'import { restore } from "$model/client/workbench/methods/open/restore/restore";\n' +
      'import { touch } from "$model/client/workbench/methods/shared/touch";\n\n' +
      "export const open = (tabs: Tab[], resource: string): Tab => {\n" +
      "  const tab = restore(tabs, canonicalResource(resource));\n  touch(tabs, tab.id);\n  return tab;\n};\n"
  );
  model(
    "client/workbench/methods/open/canonical-resource.ts",
    "export const canonicalResource = (resource: string): string => resource.trim();\n"
  );
  model(
    "client/workbench/methods/open/restore/restore.ts",
    'import { validateStoredKind } from "$model/client/workbench/methods/open/restore/validate-stored-kind";\n\n' +
      "export const restore = (tabs: Tab[], resource: string): Tab => validateStoredKind(tabs, resource);\n"
  );
  model(
    "client/workbench/methods/open/restore/validate-stored-kind.ts",
    "export const validateStoredKind = (tabs: Tab[], resource: string): Tab => tabs[0];\n"
  );
  model("client/workbench/methods/shared/shared.md", "# Shared Workbench Methods\n");
  model(
    "client/workbench/methods/shared/touch.ts",
    "export const touch = (tabs: Tab[], id: string): void => {};\n"
  );

  model("client/workbench/docs/panel-geometry.md", "# Panel Geometry\n");
  model("client/workbench/test/unit/methods/activate.test.ts", "// activate moves the active id\n");
  model("client/workbench/test/regression/reopened-tab-duplicates.test.ts", "// one fixed defect\n");
  model("client/workbench/test/non-functional/isolation.test.ts", "// two graphs share nothing\n");

  // ----------------------------------------------------------------- storage ----
  model("client/storage/storage.md", "# Storage\n");
  model(
    "client/storage/index.ts",
    'export { createStorage } from "$model/client/storage/constructor";\n' +
      'export type { StorageModel } from "$model/client/storage/types";\n'
  );
  model("client/storage/types.ts", "export interface StorageModel {\n  read(key: string): unknown;\n}\n");
  model(
    "client/storage/definition.ts",
    'import type { StorageModel } from "$model/client/storage/types";\n\n' +
      "export class Storage implements StorageModel {\n" +
      "  readonly #key: string;\n\n" +
      "  constructor(projectId: string) {\n    this.#key = `workbench:${projectId}`;\n  }\n\n" +
      "  read(key: string): unknown {\n    return null;\n  }\n}\n"
  );
  model(
    "client/storage/constructor.ts",
    'import { Storage } from "$model/client/storage/definition";\n' +
      'import type { StorageModel } from "$model/client/storage/types";\n\n' +
      "export const createStorage = (projectId: string): StorageModel => new Storage(projectId);\n"
  );
  model("client/storage/methods/methods.md", "# Storage Methods\n\n`read`.\n");
  model("client/storage/methods/read.ts", "export const read = (key: string): unknown => null;\n");
  model("client/storage/test/unit/read.test.ts", "// read returns null for an unknown key\n");

  // ------------------------------------------------------------- server root ----
  model("server/server.md", "# The Server Model\n");
  model(
    "server/index.server.ts",
    'import { buildServerModel } from "$model/server/constructor.server";\n' +
      'import type { ServerModel } from "$model/server/types";\n\n' +
      "let process: ServerModel | undefined;\n\n" +
      "export const serverModel = (): ServerModel => (process ??= buildServerModel());\n"
  );
  model(
    "server/types.ts",
    'import type { ObservabilityModel } from "$model/server/observability/index.server";\n\n' +
      "export interface ServerModel {\n  readonly observability: ObservabilityModel;\n}\n"
  );
  model(
    "server/constructor.server.ts",
    'import { createObservability } from "$model/server/observability/index.server";\n' +
      'import type { ServerModel } from "$model/server/types";\n\n' +
      "export const buildServerModel = (): ServerModel => ({\n  observability: createObservability()\n});\n"
  );
  model("server/scope.server.ts", "export interface Scope {\n  readonly userId: string;\n}\n");
  model("server/test/unit/shutdown.test.ts", "// shutdown is idempotent\n");

  model("server/observability/observability.md", "# Observability\n");
  model(
    "server/observability/index.server.ts",
    'export { createObservability } from "$model/server/observability/constructor";\n' +
      'export type { ObservabilityModel } from "$model/server/observability/types";\n'
  );
  model(
    "server/observability/types.ts",
    "export interface ObservabilityModel {\n  close(): Promise<void>;\n}\n"
  );
  model(
    "server/observability/definition.ts",
    'import type { ObservabilityModel } from "$model/server/observability/types";\n\n' +
      "export class Observability implements ObservabilityModel {\n" +
      "  async close(): Promise<void> {}\n}\n"
  );
  model(
    "server/observability/constructor.ts",
    'import { Observability } from "$model/server/observability/definition";\n' +
      'import type { ObservabilityModel } from "$model/server/observability/types";\n\n' +
      "export const createObservability = (): ObservabilityModel => new Observability();\n"
  );
  model("server/observability/methods/methods.md", "# Observability Methods\n\n`close`.\n");
  model("server/observability/methods/close.ts", "export const close = async (): Promise<void> => {};\n");
  model("server/observability/test/unit/close.test.ts", "// close ends the log stream\n");

  // ------------------------------------------------------------------ routes ----
  write(root, "routes/app/+layout.ts", "export const ssr = false;\n");
  write(
    root,
    "routes/app/+layout.svelte",
    '<script lang="ts">\n' +
      '  import { initClientModel } from "$model/client";\n\n' +
      "  const { data, children } = $props();\n" +
      "  initClientModel({ projectId: data.projectId });\n" +
      "</script>\n\n{@render children()}\n"
  );
  write(
    root,
    "routes/app/[project]/+page.svelte",
    '<script lang="ts">\n' +
      '  import { clientModel } from "$model/client";\n\n' +
      "  const { workbench } = clientModel();\n" +
      "</script>\n\n<p>{workbench.tabs.length}</p>\n"
  );
  write(
    root,
    "hooks.server.ts",
    'import { serverModel } from "$model/server/index.server";\n\n' +
      "export const handle = async ({ event, resolve }) => {\n" +
      "  event.locals.model = serverModel();\n  return resolve(event);\n};\n"
  );
};

/** Each fixture is `clean` plus exactly one defect. */
export const FIXTURES = {
  clean,

  // layout ----------------------------------------------------------------
  "layout-unknown-directory": (root) => {
    clean(root);
    write(root, `${MODEL}/client/workbench/state/tabs.ts`, "export const tabs = [];\n");
  },

  // An object root holds what the object *is*. A module that is neither state
  // nor a method has no home there — `methods/` is where everything an object
  // does belongs, and a file at the root is one nobody decided the home of.
  "layout-unknown-file": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/storage/helpers.ts`,
      "export const helper = (value: string): string => value.trim();\n"
    );
  },

  "layout-runes-in-plain-definition": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/storage/definition.ts`,
      'import type { StorageModel } from "$model/client/storage/types";\n\n' +
        "export class Storage implements StorageModel {\n" +
        "  #cache = $state<string | undefined>(undefined);\n\n" +
        "  read(key: string): unknown {\n    return this.#cache;\n  }\n}\n"
    );
  },

  // graph -----------------------------------------------------------------
  "aggregate-undeclared-field": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/types.ts`,
      'import type { StorageModel } from "$model/client/storage";\n\n' +
        "export interface ClientModelInput {\n  readonly projectId: string;\n}\n\n" +
        "export interface ClientModel {\n  readonly storage: StorageModel;\n}\n"
    );
  },

  "aggregate-double-construction": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/constructor.ts`,
      'import { createStorage } from "$model/client/storage";\n' +
        'import { createWorkbench } from "$model/client/workbench";\n' +
        'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
        "export const buildClientModel = (input: ClientModelInput): ClientModel => ({\n" +
        "  storage: createStorage(input.projectId),\n" +
        "  workbench: createWorkbench(createStorage(input.projectId))\n" +
        "});\n"
    );
  },

  // The order the root assembles in is the order a constructor receives what it
  // depends on. Reversed, the argument is whatever was in scope — usually
  // `undefined`, and only at runtime.
  "graph-out-of-order": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/constructor.ts`,
      'import { createStorage } from "$model/client/storage";\n' +
        'import { createWorkbench } from "$model/client/workbench";\n' +
        'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
        "export const buildClientModel = (input: ClientModelInput): ClientModel => {\n" +
        "  const storage = createStorage(input.projectId);\n" +
        "  return { workbench: createWorkbench(storage), storage };\n" +
        "};\n"
    );
    write(
      root,
      `${MODEL}/client/types.ts`,
      'import type { StorageModel } from "$model/client/storage";\n' +
        'import type { WorkbenchModel } from "$model/client/workbench";\n\n' +
        "export interface ClientModelInput {\n  readonly projectId: string;\n}\n\n" +
        "export interface ClientModel {\n" +
        "  readonly workbench: WorkbenchModel;\n" +
        "  readonly storage: StorageModel;\n" +
        "}\n"
    );
  },

  // lifetime --------------------------------------------------------------
  "module-load-construction": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/activate.ts`,
      'import { touch } from "$model/client/workbench/methods/shared/touch";\n\n' +
        "const scratch = new Workbench();\n\n" +
        "export const activate = (tabs: Tab[], id: string): void => {\n  touch(tabs, id);\n};\n"
    );
  },

  "module-load-mutable-binding": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/storage/methods/read.ts`,
      "let cached: unknown;\n\nexport const read = (key: string): unknown => cached;\n"
    );
  },

  // A `let` at an environment root is the convenience cache this rule exists to
  // stop: it is not below an object, so the old shape of the rule never saw it,
  // and a second holder is a second graph.
  "lifetime-root-holder": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/constructor.ts`,
      'import { createStorage } from "$model/client/storage";\n' +
        'import { createWorkbench } from "$model/client/workbench";\n' +
        'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
        "let cached: ClientModel | undefined;\n\n" +
        "export const buildClientModel = (input: ClientModelInput): ClientModel => {\n" +
        "  const storage = createStorage(input.projectId);\n" +
        "  return { storage, workbench: createWorkbench(storage) };\n" +
        "};\n"
    );
  },

  // A leaf reaching the framework takes its identity from ambient routing rather
  // than from the argument its constructor was handed.
  "lifetime-framework-import": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/activate.ts`,
      'import { page } from "$app/state";\n' +
        'import { touch } from "$model/client/workbench/methods/shared/touch";\n\n' +
        "export const activate = (tabs: Tab[], id: string): void => {\n" +
        "  touch(tabs, page.params.project ?? id);\n};\n"
    );
  },

  // Without the guard, reaching a tab's graph from the server reports as a
  // question of order — which sends the reader looking for a missing init call
  // that was never the problem.
  "lifetime-unguarded-accessor": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/index.ts`,
      'import { buildClientModel } from "$model/client/constructor";\n' +
        'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
        "let instance: ClientModel | undefined;\n\n" +
        "export const initClientModel = (input: ClientModelInput): ClientModel =>\n" +
        "  (instance = buildClientModel(input));\n\n" +
        "export const clientModel = (): ClientModel => {\n" +
        '  if (!instance) throw new Error("The client model has not been built.");\n' +
        "  return instance;\n" +
        "};\n"
    );
  },

  // lifetime --------------------------------------------------------------
  "client-init-second-initializer": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/index.ts`,
      'export { createWorkbench } from "$model/client/workbench/constructor";\n' +
        'export type { Tab, WorkbenchModel } from "$model/client/workbench/types";\n' +
        "export const initClientModel = (input: unknown) => createWorkbench(input);\n"
    );
  },

  "client-init-outside-layout": (root) => {
    clean(root);
    write(
      root,
      "routes/app/[project]/+page.svelte",
      '<script lang="ts">\n' +
        '  import { initClientModel } from "$model/client";\n\n' +
        "  const { workbench } = initClientModel({ projectId: \"p\" });\n" +
        "</script>\n\n<p>{workbench.tabs.length}</p>\n"
    );
  },

  // environment -----------------------------------------------------------
  "client-ssr-unguarded-route": (root) => {
    clean(root);
    write(
      root,
      "routes/public/+page.svelte",
      '<script lang="ts">\n  import { clientModel } from "$model/client";\n\n' +
        "  const { workbench } = clientModel();\n</script>\n\n<p>{workbench.tabs.length}</p>\n"
    );
  },

  // environment -----------------------------------------------------------
  "server-boundary-browser-import": (root) => {
    clean(root);
    write(
      root,
      "routes/app/[project]/+page.svelte",
      '<script lang="ts">\n  import { serverModel } from "$model/server/index.server";\n\n' +
        "  const { observability } = serverModel();\n</script>\n\n<p>{observability}</p>\n"
    );
  },

  // graph / doors ---------------------------------------------------------
  "construction-cycle": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/storage/constructor.ts`,
      'import { Storage } from "$model/client/storage/definition";\n' +
        'import type { WorkbenchModel } from "$model/client/workbench";\n' +
        'import type { StorageModel } from "$model/client/storage/types";\n\n' +
        "export const createStorage = (workbench: WorkbenchModel): StorageModel => new Storage(workbench);\n"
    );
  },

  // Reaching a constructor from outside is two failures, not one: it is also a
  // door the importer went around. Both are real, and the test asserts both.
  "construction-consumer-imports-constructor": (root) => {
    clean(root);
    write(
      root,
      "routes/app/[project]/+page.svelte",
      '<script lang="ts">\n  import { createWorkbench } from "$model/client/workbench/constructor";\n\n' +
        "  const workbench = createWorkbench();\n</script>\n\n<p>{workbench.tabs.length}</p>\n"
    );
  },

  // methods ---------------------------------------------------------------
  "method-tree-dangling": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/open/open.md`,
      "# Method: `open`\n\n## Method Tree\n\n```text\nopen(tabs, resource)\n" +
        "└── paginate()   paginate.ts\n```\n"
    );
  },

  "method-missing-entry": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/close/detach.ts`,
      "export const detach = (tabs: Tab[]): void => {};\n"
    );
  },

  // methods ---------------------------------------------------------------
  "method-ownership-sibling-import": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/activate.ts`,
      'import { canonicalResource } from "$model/client/workbench/methods/open/canonical-resource";\n' +
        'import { touch } from "$model/client/workbench/methods/shared/touch";\n\n' +
        "export const activate = (tabs: Tab[], id: string): void => {\n  touch(tabs, canonicalResource(id));\n};\n"
    );
  },

  "method-ownership-lonely-shared": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/activate.ts`,
      "export const activate = (tabs: Tab[], id: string): void => {};\n"
    );
  },

  // doors -----------------------------------------------------------------
  "doors-deep-import": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/constructor.ts`,
      'import { createStorage } from "$model/client/storage";\n' +
        'import { Workbench } from "$model/client/workbench/definition.svelte";\n' +
        'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
        "export const buildClientModel = (input: ClientModelInput): ClientModel => {\n" +
        "  const storage = createStorage(input.projectId);\n" +
        "  return { storage, workbench: new Workbench(storage) };\n" +
        "};\n"
    );
  },

  // tests -----------------------------------------------------------------
  "tests-beside-code": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/methods/activate.test.ts`,
      "// beside the code it covers\n"
    );
  },

  "tests-unknown-kind": (root) => {
    clean(root);
    write(root, `${MODEL}/client/workbench/test/behaviour/open.test.ts`, "// what kind of proof is this\n");
  },

  // view-keys -------------------------------------------------------------
  "view-keys-component-type": (root) => {
    clean(root);
    write(
      root,
      `${MODEL}/client/workbench/types.ts`,
      'import type { Component } from "svelte";\n\n' +
        "export interface Tab {\n  readonly id: string;\n  readonly icon: Component;\n}\n\n" +
        "export interface WorkbenchModel {\n" +
        "  readonly tabs: readonly Tab[];\n" +
        "  open(resource: string): Tab;\n" +
        "  activate(id: string): void;\n" +
        "}\n"
    );
  }
};

/** Builds every fixture under `into`, replacing whatever was there. */
export const buildFixtures = (into) => {
  rmSync(into, { recursive: true, force: true });
  for (const [name, build] of Object.entries(FIXTURES)) {
    const root = join(into, name);
    mkdirSync(root, { recursive: true });
    build(root);
  }
  return into;
};
