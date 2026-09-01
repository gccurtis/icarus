/**
 * Every check fires.
 *
 * A rule with a typo'd condition never fires, and a linter that never fires
 * reports success forever — so each check is pointed at a tree broken in exactly
 * the way it is meant to catch, and has to report *that file*. The pristine tree
 * is measured first and subtracted, so a check that was already unhappy about
 * something else cannot pass by accident.
 *
 *     pnpm test:scripts
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { breaking, discard, sandbox, treeIn } from "./sandbox.mjs";
import { MUTATIONS } from "./mutations.mjs";

const TREES = [
  "capabilities", "components", "model", "representation", "runtime",
  "styles", "surfaces", "views", "across"
];

const lintRoot = new URL("../lint/", import.meta.url).pathname;

const allChecks = async () => {
  const found = [];
  for (const tree of TREES) {
    for (const file of readdirSync(join(lintRoot, tree)).sort()) {
      if (!file.endsWith(".mjs")) continue;
      const module = await import(pathToFileURL(join(lintRoot, tree, file)).href);
      found.push({ tree, ...module.default });
    }
  }
  return found;
};

const key = ({ subject, path, message }) => `${subject ?? ""}|${path}|${message}`;

let base;
let checks;
let baseline;

before(async () => {
  base = sandbox();
  checks = await allChecks();
  const tree = await treeIn(base);

  baseline = new Map();
  for (const check of checks) {
    baseline.set(check.name, new Set((await check.run(tree)).map(key)));
  }
});

after(() => discard(base));

describe("every check has a way to fail", () => {
  test("and a mutation that proves it", async () => {
    const named = new Set(MUTATIONS.map((mutation) => mutation.check));
    const missing = checks.map(({ name }) => name).filter((name) => !named.has(name));
    assert.deepEqual(missing, [], "checks with no mutation to prove they fire");
  });
});

describe("checks fire on a tree broken the way they describe", () => {
  for (const mutation of MUTATIONS) {
    test(`${mutation.tree ? `${mutation.tree}/` : ""}${mutation.check} · ${mutation.says}`, async () => {
      // Two trees hold a check of the same name, so a mutation aimed at one of
      // them says which.
      const check = checks.find(
        ({ tree, name }) => name === mutation.check && (!mutation.tree || tree === mutation.tree)
      );
      assert.ok(check, `${mutation.check} is not a check`);

      const found = await breaking(base, mutation.changes, (tree) => check.run(tree));
      const fresh = found.filter((failure) => !baseline.get(check.name).has(key(failure)));

      assert.ok(
        fresh.length > 0,
        `${check.name} reported nothing new about ${mutation.names}`
      );
      assert.ok(
        fresh.some((failure) => failure.path.endsWith(mutation.names)),
        `${check.name} reported ${fresh.map((f) => f.path).join(", ")}, none of them ${mutation.names}`
      );
      if (mutation.subject) {
        assert.ok(
          fresh.some((failure) => failure.subject === mutation.subject),
          `${check.name} reported no finding under ${mutation.subject}`
        );
      }
    });
  }
});
