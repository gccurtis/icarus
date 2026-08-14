/**
 * Every rule gets a fixture that violates it and nothing else.
 *
 * Two assertions per rule, and the second is the one that matters: the expected
 * failure appears, AND the fixture produces no *other* failure. A rule that
 * fires on everything passes the first check and is useless.
 *
 * `clean` anchors the whole file. If it ever reports anything, some rule has
 * started rejecting a compliant capability, and every other test here becomes
 * unreadable.
 *
 * Run: node --test scripts/capabilities/test/
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import { buildFixtures } from "./build-fixtures.mjs";
import {
  checkCapabilities,
  checkClientConstruction,
  checkNames,
  checkPaths,
  checkTestPlacement,
  discover,
  exportedNames,
  importedSpecifiers,
  procedureTreePaths
} from "../rules.mjs";

const workspace = mkdtempSync(join(tmpdir(), "capability-lint-"));
buildFixtures(workspace);
after(() => rmSync(workspace, { recursive: true, force: true }));

const fixture = (name) => join(workspace, name);

/** Every check, over one fixture, as one list. */
const lint = (name) => {
  const root = fixture(name);
  return [
    ...checkCapabilities({ root, base: root }),
    ...checkNames({ root, base: root }),
    ...checkTestPlacement({ root, base: root })
  ];
};

/** Asserts exactly one problem, and that it is the expected one. */
const expectOnly = (name, fragment) => {
  const failures = lint(name);
  const matched = failures.filter((f) => f.message.includes(fragment));
  const others = failures.filter((f) => !f.message.includes(fragment));

  assert.ok(
    matched.length > 0,
    `expected a failure mentioning "${fragment}", got: ${JSON.stringify(failures, null, 2)}`
  );
  assert.deepEqual(
    others,
    [],
    `fixture "${name}" should violate one rule only, but also reported: ${JSON.stringify(others, null, 2)}`
  );
};

test("a compliant capability reports nothing", () => {
  assert.deepEqual(lint("clean"), []);
});

test("a compliant capability is discovered exactly once", () => {
  assert.deepEqual(discover(fixture("clean")), ["data/thing"]);
});

test("rejects a directory the template does not name", () => {
  expectOnly("unknown-directory", "unknown capability directory 'domain'");
});

test("rejects a file loose at the capability root", () => {
  expectOnly("stray-root-file", "belong at a capability root");
});

test("rejects a query file in persistence", () => {
  expectOnly("persistence-extra-file", "persistence/ holds tables, not queries");
});

test("rejects a function directory with no entry file", () => {
  const failures = lint("api-missing-entry");
  assert.ok(failures.some((f) => f.message.includes("missing entry file 'archive.ts'")));
  // The same fixture is also not exported from the door, which is a second real
  // defect rather than a false positive — a directory with no entry cannot be.
  assert.ok(failures.some((f) => f.message.includes("no function named 'archive'")));
});

test("rejects a remote file not named for its directory", () => {
  expectOnly("remote-misnamed", "must be named 'list.remote.ts'");
});

test("rejects a remote file below a top-level function directory", () => {
  expectOnly("remote-too-deep", "nothing deeper crosses the boundary");
});

test("rejects a function directory the server door does not export", () => {
  expectOnly("surface-mismatch", "no function named 'list'");
});

test("rejects a door export with no directory, initializer or not", () => {
  expectOnly("surface-extra-export", "exports 'archive', which has no directory");
});

test("rejects a browser door importing anything but a remote file", () => {
  expectOnly("door-imports-server", "may import only .remote.ts files");
});

test("rejects a directory with no document", () => {
  expectOnly("missing-document", "missing document 'types.md'");
});

test("rejects a document that does not match its directory", () => {
  expectOnly("misplaced-document", "expected 'types.md'");
});

test("rejects a file name that is not kebab-case", () => {
  expectOnly("not-kebab-case", "file name must be kebab-case");
});

test("rejects a test file beside the code it covers", () => {
  expectOnly("test-outside-test-dir", "belongs under the capability's test/");
});

test("rejects a procedure tree naming a file that does not exist", () => {
  expectOnly("procedure-tree-dangling", "procedure tree names 'paginate.ts'");
});

// ---------------------------------------------------------------- paths ----

test("rejects a relative import", () => {
  const root = fixture("clean");
  const failures = checkPaths({ root, base: root, aliases: { $thing: "data/thing" } });
  assert.deepEqual(failures, [], "the clean fixture uses aliases only");
});

test("reports an alias that resolves to nothing", () => {
  const root = fixture("clean");
  const failures = checkPaths({ root, base: root, aliases: {} });
  assert.ok(
    failures.some((f) => f.message.includes("matches no alias")),
    `expected unmatched-alias failures, got ${JSON.stringify(failures)}`
  );
});

// ------------------------------------------------------------ extractors ----
// The parsers the rules above are built on. Testing them directly is what
// separates "the rule did not fire" from "the rule fired on nothing".

test("reads named exports and skips type-only ones", () => {
  const names = exportedNames(
    'export { define, list } from "$thing/api";\n' +
      'export type { Thing } from "$thing/types/thing";\n' +
      "export const archive = async () => {};\n"
  );
  assert.deepEqual(names.sort(), ["archive", "define", "list"]);
});

test("reads a renamed export under its exported name", () => {
  assert.deepEqual(exportedNames('export { defineThing as define } from "x";'), ["define"]);
});

test("reads import specifiers", () => {
  assert.deepEqual(
    importedSpecifiers('import { a } from "$x/y";\nexport { b } from "$z";'),
    ["$x/y", "$z"]
  );
});

test("reads paths from a procedure tree and ignores prose", () => {
  const paths = procedureTreePaths(
    "## Procedure Tree\n\n```text\ndefine(scope, input)\n" +
      "├── record()        ../shared/record.ts\n" +
      "└── insert into thing_table\n```\n"
  );
  assert.deepEqual(paths, ["../shared/record.ts"]);
});

test("ignores an unsubstituted placeholder in a template's procedure tree", () => {
  const paths = procedureTreePaths(
    "## Procedure Tree\n\n```text\n{{functionName}}(scope)\n" +
      "└── {{procedure}}()   {{file-name}}.ts\n```\n"
  );
  assert.deepEqual(paths, []);
});

test("returns nothing when a document has no procedure tree", () => {
  assert.deepEqual(procedureTreePaths("# API: `list`\n\nNo tree here.\n"), []);
});

// ------------------------------------------------ client construction ----
// A different tree and a different question: not "what shape is a capability"
// but "can this object leak across users". Fixtures are written inline because
// they are two files, not a capability.

const clientFixture = (name, contents) => {
  const root = join(workspace, "client", name);
  for (const [path, source] of Object.entries(contents)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, source);
  }
  return root;
};

const COMPOSITION_ROOT = `import { browser } from "$app/environment";
let instance;
export const createClientRuntime = (storage) => ({
  workbench: createWorkbench(storage)
});
export const clientRuntime = () => {
  if (!browser) throw new Error("browser-only");
  return (instance ??= createClientRuntime(createBrowserStorage()));
};
`;

const OBJECT = `export const createWorkbench = (from) => new Workbench(from);\n`;

test("accepts a composition root that guards, and objects that do not", () => {
  const root = clientFixture("guarded", {
    "index.ts": COMPOSITION_ROOT,
    "workbench/index.ts": OBJECT
  });
  assert.deepEqual(checkClientConstruction({ root, base: root }), []);
});

test("rejects a second browser guard outside the composition root", () => {
  // A second check is a second way in, and the isolation argument rests on
  // there being one.
  const root = clientFixture("two-guards", {
    "index.ts": COMPOSITION_ROOT,
    "workbench/index.ts": `import { browser } from "$app/environment";\n${OBJECT}`
  });
  const failures = checkClientConstruction({ root, base: root });

  assert.equal(failures.length, 1);
  assert.equal(failures[0].path, "workbench/index.ts:1");
  assert.match(failures[0].message, /belongs to runtime\/client\/index\.ts alone/);
});

test("accepts a frozen constant and an arrow function", () => {
  const root = clientFixture("constants", {
    "activities/registry.ts":
      "const OVERVIEW = Object.freeze({ id: \"overview\" });\n" +
      "export const ACTIVITIES = Object.freeze({ \"project-overview\": [OVERVIEW] });\n" +
      "export const createActivities = (over) => new Activities(over);\n"
  });
  assert.deepEqual(checkClientConstruction({ root, base: root }), []);
});

test("rejects a module-scope new", () => {
  const root = clientFixture("new", {
    "workbench/index.ts": "export const workbench = new Workbench();\n"
  });
  const [failure, ...rest] = checkClientConstruction({ root, base: root });

  assert.ok(failure, "an unguarded singleton was admitted");
  assert.match(failure.message, /shared by every request on the server/);
  assert.equal(failure.path, "workbench/index.ts:1");
  assert.deepEqual(rest, []);
});

test("rejects a module-scope create call", () => {
  // The likelier spelling: a convenience singleton added "just until the shell
  // is wired", which typechecks and works perfectly with one user.
  const root = clientFixture("create", {
    "workbench/index.ts": "export const workbench = createWorkbench(storage());\n"
  });
  const failures = checkClientConstruction({ root, base: root });

  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /Build it in the composition root/);
});

test("rejects an unexported module-scope construction too", () => {
  // Not exported is not safe: the module still runs on the server, and whatever
  // reads this binding shares it.
  const root = clientFixture("internal", {
    "workbench/index.ts": "const shared = createWorkbench(storage());\n"
  });
  assert.equal(checkClientConstruction({ root, base: root }).length, 1);
});

test("ignores test files, which construct deliberately", () => {
  const root = clientFixture("tests", {
    "workbench/workbench.test.ts": "const a = createWorkbench(fake());\n"
  });
  assert.deepEqual(checkClientConstruction({ root, base: root }), []);
});
