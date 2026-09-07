import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { seedStore } from "../seed.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "icarus-seed-test-"));
  roots.push(root);
  const from = join(root, "seed");
  const to = join(root, "data");
  mkdirSync(from);
  mkdirSync(to);
  writeFileSync(join(from, "documents.json"), "[]\n");
  return { from, to };
};

test("a forced seed removes tables that have no committed fixture", () => {
  const { from, to } = fixture();
  writeFileSync(join(to, "documents.json"), "[{\"stale\":true}]\n");
  writeFileSync(join(to, "workspaceRevisions.json"), "[{\"revision\":9}]\n");

  const result = seedStore({ from, to, force: true });

  assert.deepEqual(result.removed, ["workspaceRevisions.json"]);
  assert.equal(readFileSync(join(to, "documents.json"), "utf8"), "[]\n");
  assert.throws(() => readFileSync(join(to, "workspaceRevisions.json"), "utf8"));
});

test("an ordinary seed preserves represented work", () => {
  const { from, to } = fixture();
  writeFileSync(join(to, "documents.json"), "[{\"kept\":true}]\n");

  const result = seedStore({ from, to });

  assert.deepEqual(result.kept, ["documents.json"]);
  assert.equal(readFileSync(join(to, "documents.json"), "utf8"), "[{\"kept\":true}]\n");
});
