/**
 * The generators' central claim is that everything they write already passes
 * `pnpm lint:capabilities`. These tests check exactly that, by generating into a
 * throwaway package and running the real rules over the result.
 *
 * It is the only test worth writing here. Asserting that a file exists, or that
 * a string was substituted, would pass just as happily for a scaffold the
 * standard rejects — and a generator whose output fails lint teaches people that
 * the standard is optional.
 *
 * Run: pnpm test:generation
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import {
  checkCapabilities,
  checkNames,
  checkPaths,
  checkTestPlacement
} from "../../../lint/capabilities/rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const generators = dirname(here);
const realPackageRoot = dirname(dirname(dirname(generators)));

const CAPABILITY = "thing";
const ALIASES = {
  $thing: `src/lib/capabilities/${CAPABILITY}`,
  $access: "src/lib/capabilities/access",
  $convex: "src/convex"
};

/**
 * A package with just enough in it for the generators to run: the templates
 * they render from, a config declaring the aliases they look up, and the one
 * runtime module their output imports.
 */
const makePackage = () => {
  const root = mkdtempSync(join(tmpdir(), "capability-generation-"));

  cpSync(
    join(realPackageRoot, "docs", "capability-directory", "templates"),
    join(root, "docs", "capability-directory", "templates"),
    { recursive: true }
  );

  writeFileSync(
    join(root, "svelte.config.js"),
    `export default { kit: { alias: ${JSON.stringify(ALIASES)} } };\n`
  );

  // What a generated capability imports: the gate, the generated context types,
  // and `Scope`. Stubs rather than copies — lint resolves alias targets to real
  // files, and does not read them.
  mkdirSync(join(root, "src", "convex", "_generated"), { recursive: true });
  mkdirSync(join(root, "src", "convex", "capabilities"), { recursive: true });
  mkdirSync(join(root, "src", "lib", "capabilities", "access", "types"), { recursive: true });

  writeFileSync(
    join(root, "src", "convex", "functions.ts"),
    "export const projectQuery = null;\nexport const projectMutation = null;\n"
  );
  writeFileSync(
    join(root, "src", "convex", "_generated", "server.d.ts"),
    "export type QueryCtx = unknown;\nexport type MutationCtx = unknown;\n"
  );
  writeFileSync(
    join(root, "src", "lib", "capabilities", "access", "types", "access.ts"),
    "export type Scope = { readonly projectId: string; readonly userId: string };\n"
  );

  return root;
};

const run = (script, args, packageRoot) =>
  execFileSync("node", [join(generators, script), ...args], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: packageRoot },
    encoding: "utf8"
  });

/**
 * Every check the real lint runs, over the generated tree.
 *
 * `access` is the stub capability the generated code imports `Scope` from. It is
 * not a capability under test and has no door, so the walk skips it — otherwise
 * every assertion here would carry its structural failures.
 */
const lint = (packageRoot) => {
  const scope = {
    root: join(packageRoot, "src", "lib", "capabilities"),
    base: packageRoot,
    functionsRoot: join(packageRoot, "src", "convex")
  };
  const aliases = { $lib: "src/lib", ...ALIASES };
  return [
    ...checkCapabilities(scope),
    ...checkPaths({ ...scope, aliases }),
    ...checkNames(scope),
    ...checkTestPlacement(scope)
  ].filter(({ path }) => !path.includes("capabilities/access"));
};

const workspaces = [];
after(() => {
  for (const path of workspaces) rmSync(path, { recursive: true, force: true });
});

const generate = (...steps) => {
  const root = makePackage();
  workspaces.push(root);
  for (const [script, args] of steps) run(script, args, root);
  return root;
};

test("a bare capability passes lint", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  assert.deepEqual(lint(root), []);
});

test("a capability with tables passes lint", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY, "--tables"]]);
  assert.deepEqual(lint(root), []);
});

test("a capability with one function passes lint", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY]],
    ["new-api.mjs", [CAPABILITY, "define", "--mutation"]]
  );
  assert.deepEqual(lint(root), []);
});

test("a query and a mutation are built from different builders", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY]],
    ["new-api.mjs", [CAPABILITY, "list", "--query"]],
    ["new-api.mjs", [CAPABILITY, "define", "--mutation"]]
  );
  assert.deepEqual(lint(root), []);

  const door = readFileSync(join(root, "src/convex/capabilities/thing.ts"), "utf8");
  assert.match(door, /export const list = projectQuery\(/);
  assert.match(door, /export const define = projectMutation\(/);
});

test("several functions accumulate without the door drifting", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY]],
    ["new-api.mjs", [CAPABILITY, "define", "--mutation"]],
    ["new-api.mjs", [CAPABILITY, "list", "--query"]],
    ["new-api.mjs", [CAPABILITY, "requireThing", "--query"]]
  );
  assert.deepEqual(lint(root), []);

  const door = readFileSync(join(root, "src/convex/capabilities/thing.ts"), "utf8");
  for (const name of ["define", "list", "requireThing"]) {
    assert.ok(door.includes(`export const ${name} = `), `door is missing ${name}`);
    assert.ok(door.includes(`${name}Handler`), `door does not import ${name}'s handler`);
  }
  assert.ok(!door.includes("export {};"), "the placeholder goes once a real export lands");
});

test("a camelCase function name becomes a kebab-case directory", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY]],
    ["new-api.mjs", [CAPABILITY, "applyStyle", "--mutation"]]
  );
  assert.deepEqual(lint(root), []);
  assert.ok(
    readFileSync(
      join(root, "src/lib/capabilities", CAPABILITY, "api/apply-style/apply-style.ts"),
      "utf8"
    ).includes("export const applyStyle"),
    "the directory is kebab-case and the export keeps its camelCase name"
  );
});

test("generated documents leave every unfilled decision greppable", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  const overview = readFileSync(
    join(root, "src/lib/capabilities", CAPABILITY, "overview.md"),
    "utf8"
  );
  assert.ok(!overview.includes("{{"), "no placeholder survives substitution");
  assert.ok(overview.includes("TODO"), "what could not be filled is marked TODO");
  assert.ok(overview.includes("Thing"), "what could be filled was filled");
});

test("refuses a path segment that is not kebab-case", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(() => run("new-capability.mjs", ["nameManager"], root), /must be kebab-case/);
});

test("refuses when no alias points at the capability", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run("new-capability.mjs", ["unaliased"], root),
    /no alias points at src\/lib\/capabilities\/unaliased/
  );
});

test("refuses to overwrite, and writes nothing when it refuses", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  const before = readFileSync(join(root, "src/lib/capabilities", CAPABILITY, "overview.md"), "utf8");

  assert.throws(() => run("new-capability.mjs", [CAPABILITY], root), /already exists/);

  const after = readFileSync(join(root, "src/lib/capabilities", CAPABILITY, "overview.md"), "utf8");
  assert.equal(after, before, "a refused run must not have touched anything");
});

// The kind decides whether the function may write, and a query that writes
// fails at the moment someone relies on the write rather than at the door.
test("refuses a function with no kind, and one with both", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  assert.throws(
    () => run("new-api.mjs", [CAPABILITY, "define"], root),
    /exactly one of --query or --mutation/
  );
  assert.throws(
    () => run("new-api.mjs", [CAPABILITY, "define", "--query", "--mutation"], root),
    /exactly one of --query or --mutation/
  );
});

test("refuses an unknown flag", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  assert.throws(
    () => run("new-capability.mjs", ["other/thing", "--persisted"], root),
    /unknown flag/
  );
});

test("refuses a function name that is not camelCase", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  assert.throws(
    () => run("new-api.mjs", [CAPABILITY, "apply-style"], root),
    /a function name is camelCase/
  );
});
