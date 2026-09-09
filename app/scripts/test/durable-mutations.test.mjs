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
          `export const writeSecond = async (store: { create(value: unknown): Promise<void> }): Promise<void> => {\n` +
          `  await store.create({ id: "two" });\n` +
          `};\n`
      },
      {
        path: "src/lib/capabilities/transaction-probe/api/save/save.ts",
        write:
          `import { writeSecond } from "$capabilities/transaction-probe/api/shared/write-second";\n` +
          `declare const transaction: (run: () => Promise<void>) => Promise<void>;\n` +
          `export const save = async (store: { create(value: unknown): Promise<void> }): Promise<void> => {\n` +
          `  await transaction(async () => {\n` +
          `    await store.create({ id: "one" });\n` +
          `    await writeSecond(store);\n` +
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
