import assert from "node:assert/strict";
import { test } from "node:test";
import { createRawContent } from "#rich-content/runtime-api/create/create-raw-content.js";
import { fixture } from "#rich-content/test/fixture.js";

test("reads the retired hard-break discriminator as a line break", async (context) => {
  const { database, runtime } = await fixture(context);
  await database
    .insertInto("rich_content")
    .values({
      id: "legacy-content",
      revision: 1,
      raw_content: JSON.stringify({
        atoms: [
          { id: "legacy-atom-1", kind: "text", text: "first" },
          { id: "legacy-break", kind: "hard-break" },
          { id: "legacy-atom-2", kind: "text", text: "second" }
        ],
        marks: []
      })
    })
    .execute();

  const display = await runtime.display("legacy-content");
  assert.deepEqual(
    display.lines.map((line) => line.segments[0]?.text),
    ["first", "second"]
  );
});

test("rolls back every deletion when multi-content replacement loses CAS", async (context) => {
  const { ids, store } = await fixture(context);
  const first = createRawContent("first-source", "first", ids);
  const second = createRawContent("second-source", "second", ids);
  const replacement = createRawContent("replacement", "combined", ids);
  await store.create(first);
  await store.create(second);

  const replaced = await store.replaceManyWithOne(
    [
      { id: first.id, expectedVersion: first.version },
      { id: second.id, expectedVersion: second.version + 1 }
    ],
    replacement
  );

  assert.equal(replaced, false);
  assert.ok(await store.find(first.id));
  assert.ok(await store.find(second.id));
  assert.equal(await store.find(replacement.id), undefined);
});

test("PGlite compare-and-swap permits only one writer per revision", async (context) => {
  const { ids, store } = await fixture(context);
  const content = createRawContent("cas-content", "value", ids);
  await store.create(content);
  const left = { ...content, version: 2 };
  const right = { ...content, version: 2 };

  const results = await Promise.all([
    store.compareAndSwap(1, left),
    store.compareAndSwap(1, right)
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal((await store.find(content.id))?.version, 2);
});
