/**
 * The generator's central claim is that everything it writes already passes
 * `pnpm lint:model`. These tests check exactly that, by generating into a
 * throwaway package and running the real rules over the result.
 *
 * It is the test worth writing here, and the standard makes it a runtime step too:
 * asserting that a file exists, or that a string was substituted, would pass just
 * as happily for a scaffold the standard rejects. The few assertions that are not
 * about lint are about the things lint cannot see — which binding a dependency was
 * passed under, and whether a refused run left the tree exactly as it found it.
 *
 * The fixture package is written here rather than copied from `src/`, so the
 * awkward shapes are deliberate: a client field bound under a different name
 * (`storage: store`), a field whose value is a call and has no binding at all
 * (`workbench: createWorkbench(store)`), and a server aggregate whose last member
 * is a terminal operation rather than an object.
 *
 * Run: pnpm test:scripts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import { RULES } from "../../../lint/model/rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const generator = join(dirname(here), "new-model-object.mjs");
const realPackageRoot = dirname(dirname(dirname(dirname(here))));

const ALIASES = { $model: "src/lib/model" };
const MODEL = "src/lib/model";

const file = (root, path, contents) => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
};

/**
 * A package with just enough in it for the generator to run: the templates it
 * renders from, a config declaring the alias every import it writes is spelled
 * through, and a model tree of two environments that already passes lint.
 */
const makePackage = () => {
  const root = mkdtempSync(join(tmpdir(), "model-generation-test-"));

  cpSync(
    join(realPackageRoot, "docs", "model-directory", "templates"),
    join(root, "docs", "model-directory", "templates"),
    { recursive: true }
  );

  writeFileSync(
    join(root, "svelte.config.js"),
    `export default { kit: { alias: ${JSON.stringify(ALIASES)} } };\n`
  );

  file(root, `${MODEL}/model.md`, "# The Model\n");

  // ------------------------------------------------------------- client root ----
  file(
    root,
    `${MODEL}/client/client.md`,
    "# The Client Model\n\n" +
      "| Object | Owns | Holds `$state` |\n" +
      "| --- | --- | --- |\n" +
      "| [`storage`](storage/storage.md) | This project's browser store | no |\n" +
      "| [`workbench`](workbench/workbench.md) | What is open, and what each tab holds | yes |\n\n" +
      "## Initialization\n\nThe layout that owns the instance initializes it.\n"
  );
  file(
    root,
    `${MODEL}/client/start.ts`,
    'import { browser } from "$app/environment";\n' +
      'import { buildClientModel } from "$model/client/create";\n' +
      'import type { ClientModel, ClientModelInput } from "$model/client/types";\n\n' +
      "let instance: ClientModel | undefined;\n\n" +
      "/** Called once by the layout that owns this client instance. */\n" +
      "export const initClientModel = (input: ClientModelInput): ClientModel =>\n" +
      "  (instance = buildClientModel(input));\n\n" +
      "export const clientModel = (): ClientModel => {\n" +
      '  if (!browser) throw new Error("The client model is browser-only.");\n' +
      '  if (!instance) throw new Error("The client model has not been built.");\n' +
      "  return instance;\n" +
      "};\n"
  );
  file(
    root,
    `${MODEL}/client/types.ts`,
    'import type { ClientStorage } from "$model/client/storage";\n' +
      'import type { WorkbenchModel } from "$model/client/workbench";\n\n' +
      "export type ClientModelInput = {\n" +
      "  readonly project: string;\n" +
      "  readonly storage?: ClientStorage;\n" +
      "};\n\n" +
      "export interface ClientModel {\n" +
      "  readonly project: string;\n" +
      "  readonly storage: ClientStorage;\n" +
      "  readonly workbench: WorkbenchModel;\n" +
      "}\n"
  );
  // `storage: store` and `workbench: createWorkbench(store)` are the two shapes a
  // dependency argument has to be read out of.
  file(
    root,
    `${MODEL}/client/create.ts`,
    'import { createBrowserStorage } from "$model/client/storage";\n' +
      'import type { ClientModel, ClientModelInput } from "$model/client/types";\n' +
      'import { createWorkbench } from "$model/client/workbench";\n\n' +
      "export const buildClientModel = ({ project, storage }: ClientModelInput): ClientModel => {\n" +
      "  const store = storage ?? createBrowserStorage(project);\n\n" +
      "  return {\n" +
      "    project,\n" +
      "    storage: store,\n" +
      "    workbench: createWorkbench(store)\n" +
      "  };\n" +
      "};\n"
  );

  // ----------------------------------------------------------------- storage ----
  file(root, `${MODEL}/client/storage/storage.md`, "# Storage\n");
  file(
    root,
    `${MODEL}/client/storage/index.ts`,
    'export { createBrowserStorage } from "$model/client/storage/constructor";\n' +
      'export type { ClientStorage } from "$model/client/storage/types";\n'
  );
  file(
    root,
    `${MODEL}/client/storage/types.ts`,
    "export interface ClientStorage {\n  read(key: string): unknown;\n}\n"
  );
  file(
    root,
    `${MODEL}/client/storage/definition.ts`,
    'import type { ClientStorage } from "$model/client/storage/types";\n\n' +
      "export class Storage implements ClientStorage {\n" +
      "  read(key: string): unknown {\n    return null;\n  }\n}\n"
  );
  file(
    root,
    `${MODEL}/client/storage/constructor.ts`,
    'import { Storage } from "$model/client/storage/definition";\n' +
      'import type { ClientStorage } from "$model/client/storage/types";\n\n' +
      "export const createBrowserStorage = (project: string): ClientStorage => new Storage();\n"
  );

  // --------------------------------------------------------------- workbench ----
  file(root, `${MODEL}/client/workbench/workbench.md`, "# Workbench\n");
  file(
    root,
    `${MODEL}/client/workbench/index.ts`,
    'export { createWorkbench } from "$model/client/workbench/constructor";\n' +
      'export type { WorkbenchModel } from "$model/client/workbench/types";\n'
  );
  file(
    root,
    `${MODEL}/client/workbench/types.ts`,
    "export interface WorkbenchModel {\n  readonly tabs: readonly string[];\n}\n"
  );
  file(
    root,
    `${MODEL}/client/workbench/definition.svelte.ts`,
    'import type { WorkbenchModel } from "$model/client/workbench/types";\n\n' +
      "export class Workbench implements WorkbenchModel {\n" +
      "  #tabs = $state<string[]>([]);\n\n" +
      "  get tabs(): readonly string[] {\n    return this.#tabs;\n  }\n}\n"
  );
  file(
    root,
    `${MODEL}/client/workbench/constructor.ts`,
    'import type { ClientStorage } from "$model/client/storage";\n' +
      'import { Workbench } from "$model/client/workbench/definition.svelte";\n' +
      'import type { WorkbenchModel } from "$model/client/workbench/types";\n\n' +
      "export const createWorkbench = (storage: ClientStorage): WorkbenchModel => new Workbench();\n"
  );

  // ------------------------------------------------------------- server root ----
  file(
    root,
    `${MODEL}/server/server.md`,
    "# The Server Model\n\n## The objects\n\n" +
      "| Object | Owns |\n" +
      "| ------ | ---- |\n" +
      "| [`configuration`](configuration/configuration.md) | One frozen snapshot, read once |\n\n" +
      "## Shutdown is one-way\n\nIt closes what it owns, in reverse dependency order.\n"
  );
  file(
    root,
    `${MODEL}/server/start.server.ts`,
    'import { buildServerModel } from "$model/server/create.server";\n' +
      'import type { ServerModel } from "$model/server/types";\n\n' +
      "let building: Promise<ServerModel> | undefined;\n\n" +
      "export const serverModel = (): Promise<ServerModel> => (building ??= buildServerModel());\n"
  );
  file(
    root,
    `${MODEL}/server/types.ts`,
    'import type { Configuration } from "$model/server/configuration/index.server";\n\n' +
      "export interface ServerModel {\n" +
      "  readonly configuration: Configuration;\n" +
      "  close(): Promise<void>;\n" +
      "}\n"
  );
  file(
    root,
    `${MODEL}/server/create.server.ts`,
    'import { createConfiguration } from "$model/server/configuration/index.server";\n' +
      'import type { ServerModel } from "$model/server/types";\n\n' +
      "export const buildServerModel = async (): Promise<ServerModel> => {\n" +
      "  const configuration = await createConfiguration();\n\n" +
      "  return {\n" +
      "    configuration,\n" +
      "    close: async () => {}\n" +
      "  };\n" +
      "};\n"
  );
  file(root, `${MODEL}/server/scope.server.ts`, "export interface Scope {\n  readonly userId: string;\n}\n");

  // ----------------------------------------------------------- configuration ----
  file(root, `${MODEL}/server/configuration/configuration.md`, "# Configuration\n");
  file(
    root,
    `${MODEL}/server/configuration/index.server.ts`,
    'export { createConfiguration } from "$model/server/configuration/constructor";\n' +
      'export type { Configuration } from "$model/server/configuration/types";\n'
  );
  file(
    root,
    `${MODEL}/server/configuration/types.ts`,
    "export interface Configuration {\n  get(key: string): unknown;\n}\n"
  );
  file(
    root,
    `${MODEL}/server/configuration/definition.ts`,
    'import type { Configuration } from "$model/server/configuration/types";\n\n' +
      "export class Snapshot implements Configuration {\n" +
      "  get(key: string): unknown {\n    return undefined;\n  }\n}\n"
  );
  file(
    root,
    `${MODEL}/server/configuration/constructor.ts`,
    'import { Snapshot } from "$model/server/configuration/definition";\n' +
      'import type { Configuration } from "$model/server/configuration/types";\n\n' +
      "export const createConfiguration = async (): Promise<Configuration> => new Snapshot();\n"
  );

  return root;
};

const run = (args, packageRoot) =>
  execFileSync("node", [generator, ...args], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: packageRoot },
    encoding: "utf8"
  });

/** Every rule the real `pnpm lint:model` runs, over the generated tree. */
const lint = (packageRoot) =>
  RULES.flatMap((rule) =>
    rule({
      model: join(packageRoot, MODEL),
      source: join(packageRoot, "src"),
      base: packageRoot,
      aliases: { $lib: "src/lib", ...ALIASES }
    })
  );

const workspaces = [];
after(() => {
  for (const path of workspaces) rmSync(path, { recursive: true, force: true });
});

const generate = (...runs) => {
  const root = makePackage();
  workspaces.push(root);
  for (const args of runs) run(args, root);
  return root;
};

const read = (root, path) => readFileSync(join(root, path), "utf8");

// ------------------------------------------------------------- both shapes ----

test("the fixture package starts clean, so a later failure is the generator's", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.deepEqual(lint(root), []);
});

test("a reactive client object passes lint", () => {
  const root = generate(["client", "session", "--definition", "reactive"]);
  assert.deepEqual(lint(root), []);

  assert.ok(existsSync(join(root, MODEL, "client/session/definition.svelte.ts")));
  assert.ok(!existsSync(join(root, MODEL, "client/session/definition.ts")));
  assert.match(read(root, `${MODEL}/client/session/definition.svelte.ts`), /\$state/);
});

/**
 * The standard documents this generator as `pnpm new-model-object -- client
 * <name>`, and pnpm forwards that separator to the script rather than consuming
 * it. The bug only reproduces through pnpm, so it survives every `node
 * scripts/…` run somebody reaches for to check the generator by hand.
 */
test("the leading -- pnpm forwards is not read as an argument", () => {
  const root = generate(["--", "client", "session", "--definition", "plain"]);
  assert.deepEqual(lint(root), []);
  assert.ok(existsSync(join(root, MODEL, "client/session/definition.ts")));
});

test("a plain client object passes lint, and owns no runes", () => {
  const root = generate(["client", "session", "--definition", "plain"]);
  assert.deepEqual(lint(root), []);

  assert.ok(existsSync(join(root, MODEL, "client/session/definition.ts")));
  assert.ok(!existsSync(join(root, MODEL, "client/session/definition.svelte.ts")));
  assert.doesNotMatch(read(root, `${MODEL}/client/session/definition.ts`), /\$state/);
});

test("a synchronously built server object passes lint", () => {
  const root = generate(["server", "telemetry", "--construction", "sync"]);
  assert.deepEqual(lint(root), []);

  assert.ok(existsSync(join(root, MODEL, "server/telemetry/index.server.ts")));
  assert.ok(!existsSync(join(root, MODEL, "server/telemetry/index.ts")));

  const constructor = read(root, `${MODEL}/server/telemetry/constructor.ts`);
  assert.match(constructor, /export const createTelemetry = \(\): TelemetryModel =>/);
  assert.doesNotMatch(read(root, `${MODEL}/server/create.server.ts`), /await createTelemetry/);
});

test("an asynchronously built server object is awaited by the root", () => {
  const root = generate(["server", "telemetry", "--construction", "async"]);
  assert.deepEqual(lint(root), []);

  assert.match(
    read(root, `${MODEL}/server/telemetry/constructor.ts`),
    /export const createTelemetry = async \(\): Promise<TelemetryModel>/
  );
  assert.match(read(root, `${MODEL}/server/create.server.ts`), /telemetry: await createTelemetry\(\)/);
});

// ------------------------------------------------------------- dependencies ----

test("a dependency is passed under the binding the root already has for it", () => {
  const root = generate(["client", "session", "--definition", "plain", "--depends", "storage"]);
  assert.deepEqual(lint(root), []);

  // The builder binds storage as `store`, so passing `storage` would have named
  // the optional input parameter instead.
  assert.match(read(root, `${MODEL}/client/create.ts`), /session: createSession\(store\)/);
  assert.match(
    read(root, `${MODEL}/client/session/constructor.ts`),
    /createSession = \(storage: ClientStorage\): SessionModel/
  );
});

test("a dependency with no binding is named before the return rather than rebuilt", () => {
  const root = generate(["client", "session", "--definition", "plain", "--depends", "workbench"]);
  assert.deepEqual(lint(root), []);

  const constructor = read(root, `${MODEL}/client/create.ts`);
  assert.match(constructor, /const workbench = createWorkbench\(store\);/);
  assert.match(constructor, /session: createSession\(workbench\)/);
  // One call, one instance: hoisting must not leave the original behind.
  assert.equal(constructor.match(/createWorkbench\(/g).length, 1);
});

test("an object is built after everything it depends on", () => {
  const root = generate([
    "client",
    "session",
    "--definition",
    "plain",
    "--depends",
    "storage,workbench"
  ]);
  assert.deepEqual(lint(root), []);

  const constructor = read(root, `${MODEL}/client/create.ts`);
  assert.ok(
    constructor.indexOf("workbench,") < constructor.indexOf("session:"),
    "the dependency is assigned before the object that takes it"
  );

  const types = read(root, `${MODEL}/client/types.ts`);
  assert.ok(
    types.indexOf("readonly workbench:") < types.indexOf("readonly session:"),
    "the aggregate lists them in the same order the root builds them"
  );
});

test("a new object lands before the aggregate's terminal operation", () => {
  const root = generate(["server", "telemetry", "--construction", "sync"]);
  const types = read(root, `${MODEL}/server/types.ts`);
  assert.ok(
    types.indexOf("readonly telemetry:") < types.indexOf("close()"),
    "close ends the list because it is the end of the object's life"
  );
});

test("several objects accumulate without the root drifting", () => {
  const root = generate(
    ["client", "session", "--definition", "reactive", "--depends", "storage"],
    ["client", "history", "--definition", "plain", "--depends", "session"],
    ["server", "telemetry", "--construction", "async"],
    ["server", "clock", "--construction", "sync", "--depends", "telemetry"]
  );
  assert.deepEqual(lint(root), []);

  const client = read(root, `${MODEL}/client/create.ts`);
  assert.ok(client.indexOf("session:") < client.indexOf("history:"));

  const server = read(root, `${MODEL}/server/create.server.ts`);
  assert.ok(server.indexOf("telemetry:") < server.indexOf("clock:"));
});

// ---------------------------------------------------------------- documents ----

test("the object joins the environment document's inventory", () => {
  const root = generate(["client", "session", "--definition", "reactive"]);
  const document = read(root, `${MODEL}/client/client.md`);

  assert.match(document, /\| \[`session`\]\(session\/session\.md\) \|/);
  assert.match(document, /\[`session`\].*\| yes \|/, "a reactive object is recorded as holding state");
  assert.ok(document.indexOf("`workbench`") < document.indexOf("`session`"));
});

test("generated documents leave every unfilled decision greppable", () => {
  const root = generate(["client", "session", "--definition", "plain", "--depends", "storage"]);

  for (const path of [`${MODEL}/client/session/session.md`, `${MODEL}/client/session/methods/methods.md`]) {
    const document = read(root, path);
    assert.ok(!document.includes("{{"), `${path} left a placeholder unsubstituted`);
    assert.ok(document.includes("TODO"), `${path} marked nothing as undecided`);
  }

  const document = read(root, `${MODEL}/client/session/session.md`);
  assert.match(document, /export const createSession = \(storage: ClientStorage\): SessionModel/);
  assert.match(document, /\| `storage` \| BORROWED \|/, "the dependency table has a row per dependency");
  assert.ok(!document.includes("createSessionModel"), "the constructor is named for the object");
});

test("no empty docs/ or test/ directory is created, and no method is invented", () => {
  const root = generate(["client", "session", "--definition", "plain"]);
  assert.ok(!existsSync(join(root, MODEL, "client/session/docs")));
  assert.ok(!existsSync(join(root, MODEL, "client/session/test")));
  assert.deepEqual(
    readFileSync(join(root, MODEL, "client/session/methods/methods.md"), "utf8").includes("{{"),
    false
  );
  assert.ok(!existsSync(join(root, MODEL, "client/session/methods/shared")));
});

// --------------------------------------------------------------- refusals ----

test("refuses a name that is not kebab-case", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run(["client", "Session", "--definition", "plain"], root),
    /an object directory is kebab-case/
  );
});

test("refuses a client object without --definition, and a server object without --construction", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run(["client", "session"], root),
    /a client object declares whether it owns reactive state/
  );
  assert.throws(
    () => run(["server", "telemetry", "--definition", "reactive"], root),
    /a server object holds no reactive state/
  );
});

test("refuses a dependency that is not an object here, and says what is", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run(["client", "session", "--definition", "plain", "--depends", "nowhere"], root),
    /no such object in model\/client\/ — there is storage, workbench/
  );
});

test("refuses a dependency across the environment boundary", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run(["client", "session", "--definition", "plain", "--depends", "configuration"], root),
    /is a server object — the two trees never import one another/
  );
});

test("refuses an object that would depend on itself", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run(["client", "session", "--definition", "plain", "--depends", "session"], root),
    /would depend on itself/
  );
});

test("refuses to generate into a tree that already holds a cycle", () => {
  const root = makePackage();
  workspaces.push(root);
  // Storage now takes the workbench, which already takes storage.
  file(
    root,
    `${MODEL}/client/storage/constructor.ts`,
    'import { Storage } from "$model/client/storage/definition";\n' +
      'import type { ClientStorage } from "$model/client/storage/types";\n' +
      'import type { WorkbenchModel } from "$model/client/workbench";\n\n' +
      "export const createBrowserStorage = (workbench: WorkbenchModel): ClientStorage => new Storage();\n"
  );
  assert.throws(
    () => run(["client", "session", "--definition", "plain"], root),
    /dependency cycle: client\/(storage|workbench) →/
  );
});

test("refuses to overwrite an object that is already there", () => {
  const root = generate(["client", "session", "--definition", "plain"]);
  const before = read(root, `${MODEL}/client/session/session.md`);

  assert.throws(() => run(["client", "session", "--definition", "reactive"], root), /already exists/);

  assert.equal(read(root, `${MODEL}/client/session/session.md`), before);
  assert.ok(!existsSync(join(root, MODEL, "client/session/definition.svelte.ts")));
});

test("refuses when no alias points at the model tree", () => {
  const root = makePackage();
  workspaces.push(root);
  writeFileSync(join(root, "svelte.config.js"), "export default { kit: { alias: {} } };\n");
  assert.throws(
    () => run(["client", "session", "--definition", "plain"], root),
    /no \$model alias points at src\/lib\/model/
  );
});

test("refuses async construction when the root cannot await one", () => {
  const root = makePackage();
  workspaces.push(root);
  file(
    root,
    `${MODEL}/server/create.server.ts`,
    'import { createConfiguration } from "$model/server/configuration/index.server";\n' +
      'import type { ServerModel } from "$model/server/types";\n\n' +
      "export const buildServerModel = (): ServerModel => {\n" +
      "  const configuration = createConfiguration();\n\n" +
      "  return {\n    configuration,\n    close: async () => {}\n  };\n" +
      "};\n"
  );
  assert.throws(
    () => run(["server", "telemetry", "--construction", "async"], root),
    /is not async, so nothing here can await a constructor/
  );
});

// --------------------------------------------------------------- rollback ----

/**
 * Both rollback tests refuse a write by taking permission away from one target.
 *
 * That is the only failure a test can inject from outside: anything shaped wrong
 * on disk — a file where a directory belongs, a dangling link — is refused while
 * the plan is still being made, which is the other half of the contract and is
 * covered by the collision test above. Root has no permissions to lose, so the
 * pair is skipped there rather than passing without proving anything.
 */
const asRoot = process.getuid?.() === 0;

test("a failed edit takes the whole scaffold back out", { skip: asRoot }, () => {
  const root = makePackage();
  workspaces.push(root);
  const types = read(root, `${MODEL}/client/types.ts`);

  // The first file edited, so every created file is already on disk.
  chmodSync(join(root, MODEL, "client/types.ts"), 0o444);

  assert.throws(
    () => run(["client", "session", "--definition", "plain"], root),
    /every byte was put back/
  );
  chmodSync(join(root, MODEL, "client/types.ts"), 0o644);

  assert.equal(read(root, `${MODEL}/client/types.ts`), types);
  assert.ok(!existsSync(join(root, MODEL, "client/session")), "the created directory is gone too");
  assert.deepEqual(lint(root), []);
});

test("a failed write restores the bytes of every file already edited", { skip: asRoot }, () => {
  const root = makePackage();
  workspaces.push(root);

  const types = read(root, `${MODEL}/client/types.ts`);
  const constructor = read(root, `${MODEL}/client/create.ts`);

  // The document is the last file written, and the two edits above it have
  // already landed by the time it refuses.
  chmodSync(join(root, MODEL, "client/client.md"), 0o444);

  assert.throws(
    () => run(["client", "session", "--definition", "plain", "--depends", "storage"], root),
    /every byte was put back/
  );
  chmodSync(join(root, MODEL, "client/client.md"), 0o644);

  assert.equal(read(root, `${MODEL}/client/types.ts`), types);
  assert.equal(read(root, `${MODEL}/client/create.ts`), constructor);
  assert.ok(!existsSync(join(root, MODEL, "client/session")));
  assert.deepEqual(lint(root), []);
});

// ------------------------------------------------------------------- lint ----

test("the planned result is linted before anything is written", () => {
  const root = makePackage();
  workspaces.push(root);

  // An aggregate that already disagrees with its builder is the tree's failure,
  // not the plan's, and the generator has to stay usable in it.
  const output = run(["client", "session", "--definition", "plain"], root);
  assert.match(output, /wrote 6 files, edited 3/);
  assert.deepEqual(lint(root), []);
});

test("the real templates are the ones rendered", () => {
  assert.ok(
    existsSync(join(realPackageRoot, "docs", "model-directory", "templates", "object.md")),
    "the object template moved — the generator renders it by name"
  );
});
