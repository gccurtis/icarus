import assert from "node:assert/strict";
import { test } from "vitest";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import {
  ago,
  anchorOf,
  isCommentableSelection,
  quoteOf,
  threadFields,
  threadsOn,
  type Thread
} from "$app-views/categories/document-editor/procedures/comments";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const BODY: DocumentBody = {
  rows: [
    { id: "#r1", kind: "blocks", blocks: [text("#b1", "Where the exposure sits")] },
    { id: "#r2", kind: "blocks", blocks: [text("#b2", "What it would cost")] }
  ]
};

const thread = (id: string, blockId: string, from: number, to: number): Thread =>
  ({
    _id: id,
    _creationTime: 1,
    projectId: "p",
    target: { kind: "document", id: "d" },
    within: { kind: "text", spans: [{ blockId, from: { atom: `${blockId}-atom`, offset: from }, to: { atom: `${blockId}-atom`, offset: to } }] },
    createdBy: { kind: "user", userId: "u" },
    updatedAt: 1
  }) as unknown as Thread;

test("an anchor is the selection's two ends, in document order", () => {
  assert.deepEqual(
    anchorOf(BODY, { kind: "text-selection", id: "#b1/atoms/#b1-atom@18", at: "#b1/atoms/#b1-atom@6" }),
    { kind: "text", spans: [{ blockId: "#b1", from: { atom: "#b1-atom", offset: 6 }, to: { atom: "#b1-atom", offset: 18 } }] }
  );
});

test("a selection across blocks keeps one structural span per block", () => {
  assert.deepEqual(
    anchorOf(BODY, { kind: "text-selection", id: "#b1/atoms/#b1-atom@6", at: "#b2/atoms/#b2-atom@4" }),
    {
      kind: "text",
      spans: [
        { blockId: "#b1", from: { atom: "#b1-atom", offset: 6 }, to: { atom: "#b1-atom", offset: 23 } },
        { blockId: "#b2", from: { atom: "#b2-atom", offset: 0 }, to: { atom: "#b2-atom", offset: 4 } }
      ]
    }
  );
});

test("only one contiguous selection can start a comment", () => {
  assert.equal(
    isCommentableSelection({
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@6",
      at: "#b2/atoms/#b2-atom@4"
    }),
    true,
    "one continuous range may cross block boundaries"
  );
  assert.equal(
    isCommentableSelection({
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@0",
      at: "#b1/atoms/#b1-atom@5",
      ranges: [{ id: "#b2/atoms/#b2-atom@0", at: "#b2/atoms/#b2-atom@4" }]
    }),
    false,
    "a Control/Command-added secondary range is disjoint"
  );
});

test("the quote is the text under the anchor", () => {
  const anchor = anchorOf(BODY, { kind: "text-selection", id: "#b1/atoms/#b1-atom@6", at: "#b1/atoms/#b1-atom@18" });
  assert.equal(quoteOf(BODY, anchor), "the exposure");
});

test("a multi-block quote preserves its block boundary", () => {
  const anchor = anchorOf(BODY, { kind: "text-selection", id: "#b1/atoms/#b1-atom@19", at: "#b2/atoms/#b2-atom@4" });
  assert.equal(quoteOf(BODY, anchor), "sits\nWhat");
});

test("threads on a selection are the ones whose anchors overlap it", () => {
  const threads = [thread("t1", "#b1", 0, 5), thread("t2", "#b1", 10, 20), thread("t3", "#b2", 0, 4)];

  assert.deepEqual(
    threadsOn(threads, BODY, { kind: "text-selection", id: "#b1/atoms/#b1-atom@6", at: "#b1/atoms/#b1-atom@12" }).map((held) => held._id),
    ["t2"]
  );
  assert.deepEqual(
    threadsOn(threads, BODY, { kind: "next-letter", id: "#b1/atoms/#b1-atom@3" }).map((held) => held._id),
    ["t1"],
    "a caret inside an anchor counts"
  );
});

test("one thread is returned once when several of its anchors touch the selection", () => {
  const held = {
    ...thread("t1", "#b1", 0, 5),
    within: {
      kind: "text",
      spans: [
        { blockId: "#b1", from: { atom: "#b1-atom", offset: 0 }, to: { atom: "#b1-atom", offset: 5 } },
        { blockId: "#b1", from: { atom: "#b1-atom", offset: 10 }, to: { atom: "#b1-atom", offset: 20 } }
      ]
    }
  } as Thread;

  assert.deepEqual(
    threadsOn([held], BODY, {
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@0",
      at: "#b1/atoms/#b1-atom@20"
    }).map((found) => found._id),
    ["t1"]
  );
});

test("a new thread carries the project, the document, the anchor and the quote", () => {
  const fields = threadFields({
    projectId: "p",
    documentId: "d",
    within: { kind: "text", spans: [{ blockId: "#b1", from: { atom: "#b1-atom", offset: 6 }, to: { atom: "#b1-atom", offset: 18 } }] },
    quote: "the exposure",
    by: "u",
    now: 5
  });

  assert.equal(fields.projectId, "p");
  assert.deepEqual(fields.target, { kind: "document", id: "d" });
  assert.equal(fields.quote, "the exposure");
  assert.deepEqual(fields.createdBy, { kind: "user", userId: "u" });
  assert.equal(fields.updatedAt, 5);
  assert.equal("resolution" in fields, false);
});

test("how long ago reads in the words a panel uses", () => {
  const now = 10_000_000;
  assert.equal(ago(now - 5_000, now), "just now");
  assert.equal(ago(now - 5 * 60_000, now), "5m");
  assert.equal(ago(now - 3 * 3_600_000, now), "3h");
  assert.equal(ago(now - 24 * 3_600_000, now), "yesterday");
});
