import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { after, before, describe, test } from "node:test";

import { breaking, discard, sandbox } from "./sandbox.mjs";

let base;

const run = (...arguments_) =>
  spawnSync(process.execPath, ["scripts/lint.mjs", ...arguments_], {
    cwd: base,
    encoding: "utf8"
  });

before(() => {
  base = sandbox();
});

after(() => discard(base));

describe("architecture debt is a ratchet", () => {
  test("the committed structural baseline accepts known debt", () => {
    const result = run("state-ownership");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /28 baselined/);
    assert.match(result.stdout, /0 findings/);
  });

  test("a new structural finding fails immediately", async () => {
    const result = await breaking(
      base,
      [{
        path: "src/lib/app-views/categories/project-overview/procedures/new-shared-state.ts",
        write: `let shared = 0;\nexport const next = (): number => (shared += 1);\n`
      }],
      () => run("state-ownership")
    );
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /new-shared-state\.ts/);
  });

  test("a stale baseline record fails until it is removed", async () => {
    const path = join(base, "configuration", "architecture-baseline.json");
    const baseline = JSON.parse(readFileSync(path, "utf8"));
    baseline.findings.push({
      checker: "mutable-state-has-an-instance",
      contract: "OWN-01",
      pillar: "state-ownership",
      path: "src/lib/runtime/client/start.ts",
      fingerprint: "already-repaired",
      finding: "ARCH-11",
      owner: "architecture-remediation",
      rationale: "Exercises stale entry detection",
      removal: "Remove when the structure is clean",
      review: "2099-01-01"
    });
    const result = await breaking(
      base,
      [{ path: "configuration/architecture-baseline.json", write: `${JSON.stringify(baseline, null, 2)}\n` }],
      () => run("state-ownership")
    );
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /FAIL stale/);
    assert.match(result.stdout, /already-repaired/);
  });

  test("baseline proposals are clean machine-readable JSON", () => {
    const result = run("state-ownership", "--propose-baseline");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const proposal = JSON.parse(result.stdout);
    assert.equal(proposal.version, 1);
    assert.equal(proposal.findings.length, 28);
  });
});
