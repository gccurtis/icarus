import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import importClosure from "../lint/across/pure-island-import-closure.mjs";
import ambientAuthority from "../lint/across/pure-island-has-no-ambient-authority.mjs";
import { MUTATIONS } from "./mutations/pure-functions.mjs";
import { breaking, discard, sandbox, treeIn } from "./sandbox.mjs";

const checks = new Map([
  [importClosure.name, importClosure],
  [ambientAuthority.name, ambientAuthority]
]);

const key = ({ subject, path, message }) => `${subject ?? ""}|${path}|${message}`;

let base;
let baseline;

before(async () => {
  base = sandbox();
  const tree = await treeIn(base);
  baseline = new Map();
  for (const [name, check] of checks) {
    baseline.set(name, new Set((await check.run(tree)).map(key)));
  }
});
after(() => discard(base));

describe("the pure-island checkers resist the contract's one-file bypasses", () => {
  for (const [name, check] of checks) {
    test(name, async () => {
      const attacks = MUTATIONS.filter(({ check: target }) => target === name);
      const changes = attacks.flatMap(({ changes: mutationChanges }) => mutationChanges);
      const found = await breaking(base, changes, (tree) => check.run(tree));
      const fresh = found.filter((finding) => !baseline.get(name).has(key(finding)));

      for (const attack of attacks) {
        assert.ok(
          fresh.some(
            (finding) =>
              finding.path.endsWith(attack.names) &&
              (!attack.subject || finding.subject === attack.subject)
          ),
          `${name} did not reject “${attack.says}” at ${attack.names} under ${attack.subject ?? "its checker"}`
        );
      }
    });
  }
});
