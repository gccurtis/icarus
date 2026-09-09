import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { reachableDurableMutations } from "../lint/shared/durable-mutations.mjs";
import { breaking, discard, sandbox } from "./sandbox.mjs";

let base;

before(() => {
  base = sandbox();
});

after(() => discard(base));

test("transaction context follows a called capability helper", async () => {
  await breaking(
    base,
    [
      { path: "src/lib/capabilities/transaction-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/transaction-probe/api/shared/write-second.ts",
        write:
          `export const writeSecond = (store: { create(value: unknown): void }): void => {\n` +
          `  store.create({ id: "two" });\n` +
          `};\n`
      },
      {
        path: "src/lib/capabilities/transaction-probe/api/save/save.ts",
        write:
          `import { writeSecond } from "$capabilities/transaction-probe/api/shared/write-second";\n` +
          `type Unit = { create(value: unknown): void };\n` +
          `export const save = (store: { transaction(run: (unit: Unit) => void): void }): void => {\n` +
          `  store.transaction((unit) => {\n` +
          `    unit.create({ id: "one" });\n` +
          `    writeSecond(unit);\n` +
          `  });\n` +
          `};\n`
      }
    ],
    (tree) => {
      const entry = `${tree.base}/src/lib/capabilities/transaction-probe/api/save/save.ts`;
      const mutations = reachableDurableMutations(tree, entry);
      assert.equal(mutations.length, 2);
      assert.ok(mutations.every(({ atomic }) => atomic));
      assert.ok(mutations.some(({ callPath }) => callPath.some((part) => part.includes("write-second"))));
    }
  );
});

test("an unrelated function named transaction grants no Store authority", async () => {
  await breaking(
    base,
    [
      { path: "src/lib/capabilities/fake-transaction-probe/index.ts", write: `export {};\n` },
      {
        path: "src/lib/capabilities/fake-transaction-probe/api/save/save.ts",
        write:
          `declare const transaction: (run: () => void) => void;\n` +
          `export const save = (store: { create(value: unknown): void }): void => {\n` +
          `  transaction(() => {\n` +
          `    store.create({ id: "one" });\n` +
          `    store.create({ id: "two" });\n` +
          `  });\n` +
          `};\n`
      }
    ],
    (tree) => {
      const entry = `${tree.base}/src/lib/capabilities/fake-transaction-probe/api/save/save.ts`;
      const mutations = reachableDurableMutations(tree, entry);
      assert.equal(mutations.length, 2);
      assert.ok(mutations.every(({ atomic }) => !atomic));
    }
  );
});
