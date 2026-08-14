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

const CAPABILITY = "data/thing";
const ALIASES = { $thing: `src/lib/capabilities/${CAPABILITY}`, $runtime: "src/lib/runtime" };

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

  // The server runtime a generated capability reaches: scope resolution, the
  // composition root a procedure gets its database from, and the logger
  // `record` writes to. Stubs rather than copies — lint resolves alias targets
  // to real files, and does not read them.
  mkdirSync(join(root, "src", "lib", "runtime", "server", "persistence"), { recursive: true });
  mkdirSync(join(root, "src", "lib", "runtime", "server", "observability"), { recursive: true });
  writeFileSync(
    join(root, "src", "lib", "runtime", "server", "scope.server.ts"),
    "export type Scope = { readonly projectId: string; readonly userId: string };\n"
  );
  writeFileSync(
    join(root, "src", "lib", "runtime", "server", "index.server.ts"),
    "export const serverRuntime = async () => ({});\n"
  );
  writeFileSync(
    join(root, "src", "lib", "runtime", "server", "observability", "index.server.ts"),
    "export const errorFields = () => ({});\n"
  );
  writeFileSync(
    join(root, "src", "lib", "runtime", "server", "persistence", "types.ts"),
    "export interface Database {}\n"
  );

  return root;
};

/** A package without the persistence runtime, to check that `--persisted` refuses. */
const makePackageWithoutPersistence = () => {
  const root = makePackage();
  rmSync(join(root, "src", "lib", "runtime", "server", "persistence"), {
    recursive: true,
    force: true
  });
  return root;
};

const run = (script, args, packageRoot) =>
  execFileSync("node", [join(generators, script), ...args], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: packageRoot },
    encoding: "utf8"
  });

/** Every check the real lint runs, over the generated tree. */
const lint = (packageRoot) => {
  const scope = { root: join(packageRoot, "src", "lib", "capabilities"), base: packageRoot };
  return [
    ...checkCapabilities(scope),
    ...checkPaths({ ...scope, aliases: { $lib: "src/lib", ...ALIASES } }),
    ...checkNames(scope),
    ...checkTestPlacement(scope)
  ];
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

test("a persisted, browser-facing capability passes lint", () => {
  const root = generate([
    "new-capability.mjs",
    [CAPABILITY, "--persisted", "--browser-facing"]
  ]);
  assert.deepEqual(lint(root), []);
});

test("a capability with one function passes lint", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY]],
    ["new-api.mjs", [CAPABILITY, "define"]]
  );
  assert.deepEqual(lint(root), []);
});

test("a capability with a browser-reachable function passes lint", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY, "--browser-facing"]],
    ["new-api.mjs", [CAPABILITY, "define", "--remote"]]
  );
  assert.deepEqual(lint(root), []);
});

test("several functions accumulate without the doors drifting", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY, "--persisted", "--browser-facing"]],
    ["new-api.mjs", [CAPABILITY, "define", "--remote"]],
    ["new-api.mjs", [CAPABILITY, "list", "--remote"]],
    ["new-api.mjs", [CAPABILITY, "requireThing"]]
  );
  assert.deepEqual(lint(root), []);

  const door = readFileSync(join(root, "src/lib/capabilities", CAPABILITY, "index.server.ts"), "utf8");
  for (const name of ["define", "list", "requireThing"]) {
    assert.ok(door.includes(`export { ${name} }`), `server door is missing ${name}`);
  }

  const browser = readFileSync(join(root, "src/lib/capabilities", CAPABILITY, "index.ts"), "utf8");
  assert.ok(browser.includes("define.remote"), "browser door is missing define");
  assert.ok(browser.includes("list.remote"), "browser door is missing list");
  assert.ok(
    !browser.includes("requireThing"),
    "requireThing has no --remote, so it must not reach the browser door"
  );
});

test("a camelCase function name becomes a kebab-case directory", () => {
  const root = generate(
    ["new-capability.mjs", [CAPABILITY]],
    ["new-api.mjs", [CAPABILITY, "applyStyle"]]
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

test("refuses a capability with no group", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run("new-capability.mjs", ["thing"], root),
    /a capability lives under a group/
  );
});

test("refuses when no alias points at the capability", () => {
  const root = makePackage();
  workspaces.push(root);
  assert.throws(
    () => run("new-capability.mjs", ["data/unaliased"], root),
    /no alias points at src\/lib\/capabilities\/data\/unaliased/
  );
});

test("refuses to overwrite, and writes nothing when it refuses", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  const before = readFileSync(join(root, "src/lib/capabilities", CAPABILITY, "overview.md"), "utf8");

  assert.throws(() => run("new-capability.mjs", [CAPABILITY], root), /already exists/);

  const after = readFileSync(join(root, "src/lib/capabilities", CAPABILITY, "overview.md"), "utf8");
  assert.equal(after, before, "a refused run must not have touched anything");
});

test("refuses --remote when the capability has no browser door", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  assert.throws(
    () => run("new-api.mjs", [CAPABILITY, "define", "--remote"], root),
    /--remote needs a browser door/
  );
});

test("refuses --persisted before the persistence runtime exists", () => {
  const root = makePackageWithoutPersistence();
  workspaces.push(root);
  assert.throws(
    () => run("new-capability.mjs", [CAPABILITY, "--persisted"], root),
    /--persisted needs the persistence runtime/
  );
});

test("refuses a function name that is not camelCase", () => {
  const root = generate(["new-capability.mjs", [CAPABILITY]]);
  assert.throws(
    () => run("new-api.mjs", [CAPABILITY, "apply-style"], root),
    /a function name is camelCase/
  );
});
