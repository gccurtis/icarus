/**
 * The linter and the standard describe the same rules.
 *
 * Rule names are the whole reason this linter has no numeric codes: a name is
 * meant to be read in a diagnostic and looked up in the standard. That only
 * holds while the two agree, and nothing else in the suite would notice a rule
 * renamed in one place — the lint tests assert on the name they were written
 * with, so they would keep passing on a table that had gone stale.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RULES, RULE_NAMES } from "../rules.mjs";
import { buildFixture, removeFixture, write } from "./build-fixtures.mjs";

const packageRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
const standard = join(packageRoot, "docs", "view-directory", "view-directory.md");
const rulesModule = join(packageRoot, "scripts", "lint", "views", "rules.mjs");

test("every rule in the standard's table is implemented, and no other", () => {
  const source = readFileSync(standard, "utf8");
  const table = source.slice(source.indexOf("| Rule | Enforcement |"));
  const documented = [...table.matchAll(/^\| `([a-z-]+)` \|/gm)].map(([, name]) => name);

  assert.deepEqual(documented, RULE_NAMES, "the Lint table and RULE_NAMES have drifted");
});

test("every rule name a failure can carry is one of the declared names", () => {
  const source = readFileSync(rulesModule, "utf8");
  const used = new Set([...source.matchAll(/fail\([^,]+,\s*"([a-z-]+)"/g)].map(([, name]) => name));

  assert.ok(used.size > 0, "no fail() calls were found — the pattern that finds them has drifted");
  for (const name of used) {
    assert.ok(RULE_NAMES.includes(name), `'${name}' is reported by a rule but is not a declared rule name`);
  }
});

test("every declared rule is exported and reachable", () => {
  assert.equal(RULES.length, RULE_NAMES.length);
  for (const rule of RULES) assert.equal(typeof rule, "function");
});

test("a failure is a path and a message, and the message leads with its rule", () => {
  const fixture = buildFixture();
  try {
    write(fixture, "workspace/utils/pad.ts", "export const x = 1;");
    const failures = RULES.flatMap((rule) => rule(fixture.scope));

    assert.ok(failures.length > 0);
    for (const failure of failures) {
      assert.deepEqual(Object.keys(failure).sort(), ["message", "path"]);
      assert.ok(!failure.path.startsWith("/"), "paths are reported relative to the scope's base");
      const [name] = failure.message.split(":");
      assert.ok(RULE_NAMES.includes(name), `message does not lead with a rule name: ${failure.message}`);
    }
  } finally {
    removeFixture(fixture);
  }
});

test("two runs over the same tree report the same failures in the same order", () => {
  const fixture = buildFixture();
  try {
    write(fixture, "workspace/helpers/pad.ts", "export const x = 1;");
    write(fixture, "workspace/effects/measure.ts", "export const x = 1;");

    const run = () =>
      RULES.flatMap((rule) => rule(fixture.scope)).sort(
        (a, b) => a.path.localeCompare(b.path) || a.message.localeCompare(b.message)
      );

    assert.deepEqual(run(), run());
  } finally {
    removeFixture(fixture);
  }
});
