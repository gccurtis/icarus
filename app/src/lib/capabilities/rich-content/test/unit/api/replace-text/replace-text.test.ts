import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { replaceText } from "$rich-content/api/replace-text/replace-text";
import { RichContentError } from "$rich-content/errors";
import {
  installDatabases,
  linesOf,
  scopeFor,
  withinFirstSegment
} from "$rich-content/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const code = (expected: string) => (error: unknown): boolean =>
  error instanceof RichContentError && error.code === expected;

const firstAtom = async (contentId: string) => {
  const projection = await display(scope, contentId);
  return { projection, atomId: projection.lines[0]!.segments[0]!.atomId };
};

test("replaces a range within one atom", async () => {
  const created = await create(scope, "abcdef");
  const { projection, atomId } = await firstAtom(created.contentId);

  await replaceText(scope, {
    contentId: created.contentId,
    expectedVersion: projection.version,
    atomId,
    range: { start: 2, end: 4 },
    text: "XY"
  });

  assert.deepEqual(linesOf(await display(scope, created.contentId)), ["abXYef"]);
});

test("an insertion is an empty range", async () => {
  const created = await create(scope, "abcdef");
  const { projection, atomId } = await firstAtom(created.contentId);

  await replaceText(scope, {
    contentId: created.contentId,
    expectedVersion: projection.version,
    atomId,
    range: { start: 3, end: 3 },
    text: "---"
  });

  assert.deepEqual(linesOf(await display(scope, created.contentId)), ["abc---def"]);
});

test("a deletion is an empty replacement", async () => {
  const created = await create(scope, "abcdef");
  const { projection, atomId } = await firstAtom(created.contentId);

  await replaceText(scope, {
    contentId: created.contentId,
    expectedVersion: projection.version,
    atomId,
    range: { start: 1, end: 4 },
    text: ""
  });

  assert.deepEqual(linesOf(await display(scope, created.contentId)), ["aef"]);
});

test("the atom keeps its id across the edit", async () => {
  // What lets a handle for a neighbouring atom stay meaningful, and what lets a
  // list mark keep covering its whole line.
  const created = await create(scope, "abcdef");
  const { projection, atomId } = await firstAtom(created.contentId);

  await replaceText(scope, {
    contentId: created.contentId,
    expectedVersion: projection.version,
    atomId,
    range: { start: 0, end: 1 },
    text: "Z"
  });

  const after = await display(scope, created.contentId);
  assert.equal(after.lines[0]!.segments[0]!.atomId, atomId);
});

test("a mark after the edit moves with the text it covers", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const styled = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 4, 6),
    properties: { bold: true }
  });

  await replaceText(scope, {
    contentId: created.contentId,
    expectedVersion: styled.version,
    atomId: v1.lines[0]!.segments[0]!.atomId,
    range: { start: 0, end: 1 },
    text: "AAA"
  });

  const after = await display(scope, created.contentId);
  const bold = after.lines[0]!.segments.filter(({ style }) => style.bold);

  assert.deepEqual(linesOf(after), ["AAAbcdef"]);
  assert.equal(bold.map(({ text }) => text).join(""), "ef", "the bold run still covers 'ef'");
});

test("a line break in the replacement is refused", async () => {
  const created = await create(scope, "abcdef");
  const { projection, atomId } = await firstAtom(created.contentId);

  await assert.rejects(
    () =>
      replaceText(scope, {
        contentId: created.contentId,
        expectedVersion: projection.version,
        atomId,
        range: { start: 0, end: 1 },
        text: "a\nb"
      }),
    code("unsupported-text")
  );
});

test("an unknown atom is atom-not-found", async () => {
  const created = await create(scope, "abcdef");
  const projection = await display(scope, created.contentId);

  await assert.rejects(
    () =>
      replaceText(scope, {
        contentId: created.contentId,
        expectedVersion: projection.version,
        atomId: "atom_nothing",
        range: { start: 0, end: 1 },
        text: "Z"
      }),
    code("atom-not-found")
  );
});

test("an out-of-bounds or reversed range is refused", async () => {
  const created = await create(scope, "abcdef");
  const { projection, atomId } = await firstAtom(created.contentId);

  for (const range of [
    { start: 0, end: 99 },
    { start: 4, end: 2 },
    { start: -1, end: 2 },
    { start: 0.5, end: 2 }
  ]) {
    await assert.rejects(
      () =>
        replaceText(scope, {
          contentId: created.contentId,
          expectedVersion: projection.version,
          atomId,
          range,
          text: "Z"
        }),
      code("invalid-atom-range")
    );
  }
});

test("a range splitting a surrogate pair is refused", async () => {
  // Editing between the halves of an astral character produces a lone surrogate
  // — text that no longer round trips.
  const created = await create(scope, "a😀b");
  const { projection, atomId } = await firstAtom(created.contentId);

  await assert.rejects(
    () =>
      replaceText(scope, {
        contentId: created.contentId,
        expectedVersion: projection.version,
        atomId,
        range: { start: 2, end: 3 },
        text: "Z"
      }),
    code("invalid-atom-range")
  );
});
