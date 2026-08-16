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
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { buildFixtures, functionsRootFor } from "./build-fixtures.mjs";
import {
  checkCapabilities,
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
  const functionsRoot = functionsRootFor(root);
  return [
    ...checkCapabilities({ root, base: root, functionsRoot }),
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

test("rejects a function directory with no entry file", () => {
  const failures = lint("api-missing-entry");
  assert.ok(failures.some((f) => f.message.includes("missing entry file 'archive.ts'")));
  // The same fixture is also not exported from the door, which is a second real
  // defect rather than a false positive — a directory with no entry cannot be.
  assert.ok(failures.some((f) => f.message.includes("no function named 'archive'")));
});

test("rejects a function directory the deployment door does not register", () => {
  expectOnly("surface-mismatch", "no function named 'list' is registered");
});

test("rejects a registration with no function directory", () => {
  expectOnly("surface-extra-export", "registers 'archive', which has no api/archive/ directory");
});

test("rejects a capability with no deployment door", () => {
  expectOnly("no-deployment-door", "no deployment door");
});

test("rejects a deployment door that registers a function unscoped", () => {
  expectOnly("door-registers-unscoped", "built from projectQuery/projectMutation");
});

test("rejects a capability that registers its own function", () => {
  expectOnly("capability-registers", "a capability holds handlers");
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
