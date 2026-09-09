import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CHECKER_TREES, PILLAR_TREES } from "../lint/shared/checker-trees.mjs";
import { MUTATIONS } from "./mutations.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lintRoot = join(packageRoot, "scripts", "lint");
const pillarRoot = join(
  packageRoot,
  "src",
  "lib",
  "development-views",
  "architecture-pillars",
  "procedures",
  "pillars"
);

const declaredContracts = () => {
  const found = [];
  for (const file of readdirSync(pillarRoot).filter((name) => name.endsWith(".ts") && name !== "index.ts")) {
    const text = readFileSync(join(pillarRoot, file), "utf8");
    for (const match of text.matchAll(/id:\s*"([A-Z]+-\d+)"[\s\S]*?status:\s*"(Enforced|Partial|Missing)"/g)) {
      found.push({ id: match[1], status: match[2], file });
    }
  }
  return found;
};

test("the reference catalog and executable checker graph are complete", async () => {
  const reference = declaredContracts();
  const catalog = JSON.parse(
    readFileSync(join(packageRoot, "configuration", "architecture-checkers.json"), "utf8")
  );
  const contracts = catalog.contracts ?? {};

  assert.equal(catalog.version, 1);
  assert.equal(reference.length, 45, "the eight pillar pages should declare 45 contracts");
  assert.deepEqual(
    Object.keys(contracts).sort(),
    reference.map(({ id }) => id).sort(),
    "the executable catalog must cover exactly the reference contracts"
  );
  assert.deepEqual(
    reference.filter(({ status }) => status !== "Enforced"),
    [],
    "a reference contract may say Enforced only after its checker implementation lands"
  );

  const mutated = new Set(MUTATIONS.map(({ check }) => check));
  const mapped = new Set(Object.values(contracts).flat());
  for (const [id, implementations] of Object.entries(contracts)) {
    assert.ok(implementations.length > 0, `${id} has no checker implementation`);
    for (const implementation of implementations) {
      const path = join(lintRoot, implementation);
      assert.ok(existsSync(path), `${id} names missing checker ${implementation}`);
      const name = implementation.split("/").at(-1).replace(/\.mjs$/, "");
      assert.ok(mutated.has(name), `${id}/${name} has no mutation proof`);
    }
  }

  const ids = new Map();
  for (const pillar of CHECKER_TREES) {
    for (const file of readdirSync(join(lintRoot, pillar)).filter((name) => name.endsWith(".mjs"))) {
      const implementation = `${pillar}/${file}`;
      const definition = (await import(pathToFileURL(join(lintRoot, implementation)).href)).default;
      assert.ok(mapped.has(implementation), `${implementation} is absent from every pillar contract`);
      if (!PILLAR_TREES.has(pillar)) continue;
      assert.ok(definition.id, `${implementation} has no reference contract id`);
      assert.equal(definition.pillar, pillar, `${implementation} declares the wrong pillar`);
      assert.ok(!ids.has(definition.id), `${definition.id} is claimed by two pillar checkers`);
      ids.set(definition.id, implementation);
      assert.ok(
        contracts[definition.id]?.includes(implementation),
        `${definition.id} does not map back to ${implementation}`
      );
    }
  }
  assert.equal(ids.size, 34, "all previously missing/partial contracts need an independent checker");
});
