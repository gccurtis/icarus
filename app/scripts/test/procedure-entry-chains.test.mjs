import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import definition from "../lint/cohesive-units/procedure-directory-has-one-entry-chain.mjs";
import { breaking, discard, sandbox } from "./sandbox.mjs";

let base;

before(() => {
  base = sandbox();
});

after(() => discard(base));

const path = "src/lib/app-views/categories/project-overview/procedures/family.ts";
const findingsAt = (tree) =>
  definition.run(tree).then((findings) => findings.filter((finding) => finding.path.endsWith(path)));

test("a bounded family of pure queries, formatters, predicates, and constants stays cohesive", async () => {
  const findings = await breaking(
    base,
    [{
      path,
      write: `export const LIMIT = 8;
export const rowOf = (value: number): number => value;
export const formatValue = (value: number): string => String(value);
export const isValue = (value: unknown): value is number => typeof value === "number";
export const hasValue = (value: number | undefined): boolean => value !== undefined;
`
    }],
    findingsAt
  );
  assert.deepEqual(findings, []);
});

test("mutation of function-owned working state remains observational", async () => {
  const findings = await breaking(
    base,
    [{
      path,
      write: `export const collect = (values: number[]): number[] => {
  const found: number[] = [];
  for (const value of values) found.push(value);
  return found;
};
export const index = (values: number[]): Map<number, number> => {
  const found = new Map<number, number>();
  values.forEach((value, position) => found.set(position, value));
  return found;
};
`
    }],
    findingsAt
  );
  assert.deepEqual(findings, []);
});

test("one effectful entry can keep a bounded pure support family beside it", async () => {
  const findings = await breaking(
    base,
    [{
      path,
      write: `export const LABEL = "Save";
export const labelOf = (value: string): string => value.trim();
export const save = (commit: (value: string) => void, value: string): void => commit(labelOf(value));
`
    }],
    findingsAt
  );
  assert.deepEqual(findings, []);
});

test("two synchronous callback-driven commands are two effectful entries", async () => {
  const findings = await breaking(
    base,
    [{
      path,
      write: `export const save = (commit: () => void): void => commit();
export const remove = (commit: () => void): void => commit();
`
    }],
    findingsAt
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].subject, "one-entry");
});

test("a capability command is effectful even when its name begins with resolve", async () => {
  const findings = await breaking(
    base,
    [{
      path,
      write: `import { resolveThread } from "$capabilities/comments/index.remote";
export const resolve = (): void => { resolveThread(); };
export const remove = (commit: () => void): void => commit();
`
    }],
    findingsAt
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].subject, "one-entry");
});
