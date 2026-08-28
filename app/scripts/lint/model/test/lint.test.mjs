/**
 * Every rule gets a fixture that violates it and nothing else.
 *
 * Two assertions per rule, and the second is the one that matters: the expected
 * failure appears, AND the fixture trips no *other* rule. A rule that fires on
 * everything passes the first check and is useless.
 *
 * `expectOnly` matches on the rule name rather than on one message, because a
 * single defect can be more than one finding of the same rule — an aggregate field
 * nobody declares is both an undeclared assignment and an unreachable object, and
 * splitting that into two fixtures would be splitting one mistake in half.
 *
 * `clean` anchors the whole file. If it ever reports anything, some rule has
 * started rejecting a compliant tree, and every other test here becomes
 * unreadable.
 *
 * Run: node --test scripts/lint/model/test/
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { ALIASES, FIXTURES, buildFixtures } from "./build-fixtures.mjs";
import {
  RULES,
  checkDoors,
  checkEnvironment,
  checkGraph,
  checkLayout,
  checkLifetime,
  checkMethods,
  checkTests,
  checkViewKeys,
  declaresRunes,
  discoverObjects,
  importsOf,
  methodTreePaths,
  resolveSpecifier
} from "../rules.mjs";

const workspace = mkdtempSync(join(tmpdir(), "model-lint-"));
buildFixtures(workspace);
after(() => rmSync(workspace, { recursive: true, force: true }));

/** A fixture root stands in for `src/`; the model tree sits inside it. */
const scopeFor = (name) => {
  const root = join(workspace, name);
  return { model: join(root, "lib", "model"), source: root, base: root, aliases: ALIASES };
};

const lint = (name) => {
  const scope = scopeFor(name);
  return RULES.flatMap((rule) => rule(scope));
};

/** Asserts the named rule fires, and that nothing else does. */
const expectOnly = (name, rule, fragment) => {
  const found = lint(name);
  const matched = found.filter((f) => f.message.startsWith(rule));
  const others = found.filter((f) => !f.message.startsWith(rule));

  assert.ok(
    matched.some((f) => f.message.includes(fragment)),
    `expected a ${rule} failure mentioning "${fragment}", got: ${JSON.stringify(found, null, 2)}`
  );
  assert.deepEqual(
    others,
    [],
    `fixture "${name}" should violate ${rule} only, but also reported: ${JSON.stringify(others, null, 2)}`
  );
};

test("a compliant tree reports nothing", () => {
  assert.deepEqual(lint("clean"), []);
});

test("every rule leads with its own name", () => {
  // The name is the whole of what a reader needs to find the rule, so a message
  // that does not carry one sends them to a table instead.
  const names = [
    "layout",
    "graph",
    "lifetime",
    "environment",
    "doors",
    "methods",
    "tests",
    "view-keys"
  ];
  const found = Object.keys(FIXTURES)
    .filter((fixture) => fixture !== "clean")
    .flatMap((fixture) => lint(fixture));

  assert.ok(found.length > 0, "no fixture reported anything");
  for (const failure of found) {
    assert.ok(
      names.some((name) => failure.message.startsWith(`${name} `)),
      `message does not lead with a rule name: ${failure.message}`
    );
  }
});

test("environment roots are roots, not malformed objects", () => {
  // `client/test/` and the root's own files must not be mistaken for objects, or
  // every rule below would be checking the wrong directories.
  assert.deepEqual(discoverObjects(scopeFor("clean")), [
    "client/storage",
    "client/workbench",
    "server/observability"
  ]);
});

test("an absent model tree reports nothing and does not throw", () => {
  const scope = { model: join(workspace, "nowhere"), source: join(workspace, "nowhere"), base: workspace };
  for (const rule of RULES) assert.deepEqual(rule(scope), []);
  assert.deepEqual(discoverObjects(scope), []);
});

// ----------------------------------------------------------------- layout ----

test("layout rejects a directory the template does not name", () => {
  expectOnly("layout-unknown-directory", "layout", "unknown directory 'state'");
});

test("layout rejects a file the template does not name", () => {
  // The object root holds what the object is; everything it does lives in
  // methods/. Without this, any module could sit at a root unnoticed.
  expectOnly("layout-unknown-file", "layout", "unknown file 'helpers.ts'");
});

test("layout rejects runes in a definition named .ts", () => {
  expectOnly("layout-runes-in-plain-definition", "layout", "runes do not compile in a plain .ts");
});

test("layout accepts a client object with no reactive state", () => {
  // The converse of the rule above, and the reason it is not written as "every
  // client definition is .svelte.ts": storage owns a key and a codec.
  const failures = checkLayout(scopeFor("clean"));
  assert.deepEqual(failures, []);
  assert.equal(declaresRunes(join(workspace, "clean/lib/model/client/storage/definition.ts")), false);
  assert.equal(
    declaresRunes(join(workspace, "clean/lib/model/client/workbench/definition.svelte.ts")),
    true
  );
});

// ------------------------------------------------------------------ graph ----

test("graph rejects a built field the aggregate does not declare", () => {
  expectOnly("aggregate-undeclared-field", "graph", "assigns 'workbench'");
});

test("graph rejects a leaf constructor called twice", () => {
  expectOnly("aggregate-double-construction", "graph", "is called more than once");
});

test("graph rejects an object built before what it depends on", () => {
  // The branch with real arithmetic in it, and the one that never had a fixture.
  expectOnly("graph-out-of-order", "graph", "'workbench' is built before 'storage'");
});

test("graph rejects a dependency cycle between two objects", () => {
  expectOnly("construction-cycle", "graph", "dependency cycle");
});

test("graph reads the aggregate and the builder as one pair", () => {
  assert.deepEqual(checkGraph(scopeFor("clean")), []);
});

// --------------------------------------------------------------- lifetime ----

test("lifetime rejects a construction at module load", () => {
  expectOnly("module-load-construction", "lifetime", "constructs at module load");
});

test("lifetime rejects a mutable module-scope binding below an object", () => {
  expectOnly("module-load-mutable-binding", "lifetime", "only an environment door holds an instance");
});

test("lifetime rejects a second holder at an environment root", () => {
  // Not below an object, which is exactly why the narrower shape of this rule
  // never saw it — and a second holder is a second graph.
  expectOnly("lifetime-root-holder", "lifetime", "only an environment door holds an instance");
});

test("lifetime rejects a leaf reaching the framework", () => {
  expectOnly("lifetime-framework-import", "lifetime", "only the client door reaches the framework");
});

test("lifetime rejects a second initializer", () => {
  expectOnly("client-init-second-initializer", "lifetime", "belongs to client/index.ts alone");
});

test("lifetime rejects a caller that is not the owning layout", () => {
  expectOnly("client-init-outside-layout", "lifetime", "only the layout that owns the client instance");
});

test("lifetime rejects an accessor that does not guard on browser", () => {
  expectOnly("lifetime-unguarded-accessor", "lifetime", "does not guard on 'browser'");
});

test("lifetime accepts the door's own instance, its $app import, and every factory", () => {
  // `let instance` and `import { browser }` in client/index.ts are the point of
  // the rule, not violations of it, and `const create = () => new X()` has not
  // called anything yet.
  assert.deepEqual(checkLifetime(scopeFor("clean")), []);
});

// ------------------------------------------------------------ environment ----

test("environment rejects a route reaching the client model with SSR on", () => {
  expectOnly("client-ssr-unguarded-route", "environment", "no ancestor layout exporting ssr = false");
});

test("environment rejects a browser module reaching the server tree", () => {
  expectOnly("server-boundary-browser-import", "environment", "model/server is server-only");
});

test("environment accepts a guarded route and a server-marked module", () => {
  // The guard is two directories above the page that needs it, which is why the
  // rule walks up rather than reading the route alone.
  assert.deepEqual(checkEnvironment(scopeFor("clean")), []);
});

// ------------------------------------------------------------------ doors ----

test("doors rejects an import that reaches past a door", () => {
  expectOnly("doors-deep-import", "doors", "reaches past the door of 'client/workbench'");
});

test("doors rejects a consumer importing a constructor", () => {
  // One finding, not two: reaching a constructor from a route is reaching around
  // a door, and it is the same rule saying so.
  expectOnly(
    "construction-consumer-imports-constructor",
    "doors",
    "constructors are called by the environment root"
  );
});

test("doors accepts an object reaching its own internals", () => {
  // The definition imports its own methods by alias path, which is what the alias
  // is for. Only files outside the object are held to the door.
  assert.deepEqual(checkDoors(scopeFor("clean")), []);
});

// ---------------------------------------------------------------- methods ----

test("methods rejects a tree naming a file that does not exist", () => {
  expectOnly("method-tree-dangling", "methods", "tree names 'paginate.ts'");
});

test("methods rejects a directory with no entry file", () => {
  expectOnly("method-missing-entry", "methods", "missing entry file 'close.ts'");
});

test("methods rejects one directory importing another", () => {
  expectOnly("method-ownership-sibling-import", "methods", "moves to methods/shared/");
});

test("methods rejects a promoted method with no callers", () => {
  expectOnly("method-ownership-lonely-shared", "methods", "no callers");
});

test("methods accepts a promoted method with one caller", () => {
  // Whether a second caller arrives is not the linter's judgment. A step that
  // has to be spelled identically by whoever needs it belongs in shared/ the
  // moment the first method needs it that way.
  assert.deepEqual(checkMethods(scopeFor("method-ownership-single-caller-shared")), []);
});

test("methods resolves every documented path and accepts a shared method two use", () => {
  assert.deepEqual(checkMethods(scopeFor("clean")), []);
});

// ------------------------------------------------------------------ tests ----

test("tests rejects a test beside the code it covers", () => {
  expectOnly("tests-beside-code", "tests", "not beside the code it covers");
});

test("tests rejects a directory that is not one of the three kinds", () => {
  expectOnly("tests-unknown-kind", "tests", "unit/, regression/, or non-functional/");
});

test("tests accepts the three kinds and the roots' own tests", () => {
  assert.deepEqual(checkTests(scopeFor("clean")), []);
});

// -------------------------------------------------------------- view-keys ----

test("view-keys rejects a Svelte Component in a model type", () => {
  expectOnly("view-keys-component-type", "view-keys", "Component");
});

test("view-keys finds nothing to resolve in a tree that exposes keys", () => {
  assert.deepEqual(checkViewKeys(scopeFor("clean")), []);
});

// ------------------------------------------------------------- extractors ----
// The parsers the rules are built on. Testing them directly is what separates
// "the rule did not fire" from "the rule fired on nothing".

test("reads imports from a Svelte component's script block", () => {
  const path = join(workspace, "clean/routes/app/+layout.svelte");
  const [first] = importsOf(path);
  assert.equal(first.specifier, "$model/client/start");
  assert.deepEqual(first.names, ["initClientModel"]);
  assert.equal(first.line, 2);
});

test("reads imports and their bound names from TypeScript", () => {
  const path = join(workspace, "clean/lib/model/client/create.ts");
  assert.deepEqual(
    importsOf(path).map((i) => i.specifier),
    ["$model/client/storage", "$model/client/workbench", "$model/client/types"]
  );
});

test("resolves an alias to a .svelte.ts module", () => {
  const scope = scopeFor("clean");
  const resolved = resolveSpecifier(
    "$model/client/workbench/definition.svelte",
    join(scope.model, "client/workbench/constructor.ts"),
    scope
  );
  assert.equal(resolved, join(scope.model, "client/workbench/definition.svelte.ts"));
});

test("reads paths from a method tree and ignores prose", () => {
  const paths = methodTreePaths(
    "## Method Tree\n\n```text\nopen(tabs, resource)\n" +
      "├── touch()   ../shared/touch.ts\n" +
      "└── the tab this method returns\n```\n"
  );
  assert.deepEqual(paths, ["../shared/touch.ts"]);
});

test("ignores an unsubstituted placeholder in a template's method tree", () => {
  const paths = methodTreePaths(
    "## Method Tree\n\n```text\n{{methodName}}(state)\n└── {{step}}()   {{step-name}}.ts\n```\n"
  );
  assert.deepEqual(paths, []);
});

test("returns nothing when a document has no method tree", () => {
  assert.deepEqual(methodTreePaths("# Method: `activate`\n\nNo tree here.\n"), []);
});
