import assert from "node:assert/strict";
import { describe, test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { record } from "$rich-content/api/shared/record";
import { installDatabases, scopeFor, withinFirstSegment } from "$rich-content/test/fixture";
import { stub } from "$rich-content/test/stub";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");
const events = () => stub.records.map(({ message }) => message);
const last = () => stub.records.at(-1);

describe("every call is recorded", () => {
  test("a successful call records that it started and finished", async () => {
    await create(scope, "abcdef");

    assert.deepEqual(events(), ["rich-content.create.started", "rich-content.create.completed"]);
  });

  test("a stated refusal is a warning carrying its code", async () => {
    await assert.rejects(() => display(scope, "content_nothing"));

    assert.equal(last()?.message, "rich-content.display.rejected");
    assert.equal(last()?.level, "warn");
    assert.equal((last()?.data as { errorCode: string }).errorCode, "content-not-found");
  });

  test("a fault is an error, and is not mistaken for a refusal", async () => {
    const failure = new Error("database unavailable");

    await assert.rejects(
      () =>
        record("display", { contentId: "content_x" }, async () => {
          throw failure;
        }),
      (error: unknown) => error === failure
    );

    assert.equal(last()?.message, "rich-content.display.failed");
    assert.equal(last()?.level, "error");
    assert.equal((last()?.data as { errorMessage: string }).errorMessage, "database unavailable");
  });
});

describe("what a record may never contain", () => {
  test("not one word of authored text reaches the log", async () => {
    const created = await create(scope, "the quick brown fox");
    const v1 = await display(scope, created.contentId);

    await applyStyle(scope, {
      contentId: created.contentId,
      expectedVersion: v1.version,
      range: withinFirstSegment(v1, 0, 3),
      properties: { bold: true }
    });

    const written = JSON.stringify(stub.records);
    for (const word of ["quick", "brown", "fox"]) {
      assert.ok(!written.includes(word), `logged authored text: ${word}`);
    }
  });

  test("create records the length of the text and not the text", async () => {
    await create(scope, "sensitive prose");

    const started = stub.records[0]?.data as { textLength: number };
    assert.equal(started.textLength, "sensitive prose".length);
    assert.ok(!JSON.stringify(stub.records).includes("sensitive"));
  });

  test("a link href is not recorded either", async () => {
    // A URL someone pasted is content, not an identifier of ours.
    const created = await create(scope, "abcdef");
    const v1 = await display(scope, created.contentId);
    stub.records.length = 0;

    const { setLink } = await import("$rich-content/api/set-link/set-link");
    await setLink(scope, {
      contentId: created.contentId,
      expectedVersion: v1.version,
      range: withinFirstSegment(v1, 0, 3),
      targets: [{ kind: "url", href: "https://private.example.test/secret" }]
    });

    const written = JSON.stringify(stub.records);
    assert.ok(!written.includes("private.example.test"), written);
    assert.equal((stub.records[0]?.data as { targetCount: number }).targetCount, 1);
  });
});
