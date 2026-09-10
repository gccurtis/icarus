import assert from "node:assert/strict";
import { test } from "vitest";
import { EditorState } from "prosemirror-state";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import {
  ANNOTATIONS,
  annotationDecorations,
  annotationsPlugin,
  sameAnnotations,
  spansOf,
  stacked
} from "$app-views/categories/document-editor/procedures/annotations";
import { anchoredOf } from "$app-views/categories/document-editor/procedures/comment-anchors";
import type { Thread } from "$app-views/categories/document-editor/procedures/comments";
import { docOf, positionOf } from "$app-views/categories/document-editor/procedures/projection";

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
    within: {
      kind: "text",
      spans: [
        {
          blockId,
          from: { atom: `${blockId}-atom`, offset: from },
          to: { atom: `${blockId}-atom`, offset: to }
        }
      ]
    },
    createdBy: { kind: "user", userId: "u" },
    updatedAt: 1
  }) as unknown as Thread;

const METRICS = { charactersPerLine: 40, linesPerPage: 40 };

test("an anchored thread becomes a span over its text in the projection", () => {
  const anchored = anchoredOf([thread("t1", "#b1", 6, 18), thread("t2", "#b2", 0, 4)], BODY);
  const doc = docOf(BODY, METRICS);
  const spans = spansOf(doc, { anchored, current: "t2" });

  assert.equal(spans.length, 2);
  assert.equal(doc.textBetween(spans[0].from, spans[0].to), "the exposure");
  assert.equal(doc.textBetween(spans[1].from, spans[1].to), "What");
  assert.deepEqual(spans.map((span) => span.current), [false, true]);
});

test("a thread on a block that is gone makes no span", () => {
  const anchored = anchoredOf([thread("t1", "#gone", 0, 4)], BODY);
  assert.equal(anchored.length, 0);
});

test("the plugin decorates each span, and marks the current one", () => {
  const anchored = anchoredOf([thread("t1", "#b1", 6, 18)], BODY);
  const doc = docOf(BODY, METRICS);
  const state = EditorState.create({
    doc,
    plugins: [annotationsPlugin(() => ({ anchored, current: "t1" }))]
  });

  const found = annotationDecorations(state).find();
  assert.equal(found.length, 1);
  assert.equal(doc.textBetween(found[0].from, found[0].to), "the exposure");
  assert.equal(ANNOTATIONS.getState(state)?.current, "t1");
});

test("the plugin maps anchors immediately while text is edited", () => {
  const anchored = anchoredOf([thread("t1", "#b1", 6, 18)], BODY);
  const doc = docOf(BODY, METRICS);
  const state = EditorState.create({
    doc,
    plugins: [annotationsPlugin(() => ({ anchored, current: undefined }))]
  });
  const at = positionOf(doc, { blockId: "#b1", offset: 0 });
  assert.notEqual(at, undefined);

  const next = state.apply(state.tr.insertText("++", at));
  assert.deepEqual(
    ANNOTATIONS.getState(next)?.anchored.map((held) => [held.blockId, held.from, held.to]),
    [["#b1", 8, 20]]
  );
});

test("annotations compare by thread, place and current", () => {
  const anchored = anchoredOf([thread("t1", "#b1", 6, 18)], BODY);
  assert.equal(sameAnnotations({ anchored, current: undefined }, { anchored, current: undefined }), true);
  assert.equal(sameAnnotations({ anchored, current: undefined }, { anchored, current: "t1" }), false);
  assert.equal(sameAnnotations(undefined, { anchored: [], current: undefined }), false);
});

test("pins on the same line stack, and a stack holding the current thread reads as current", () => {
  const pins = stacked([
    { id: "a", top: 100, state: "open" },
    { id: "b", top: 104, state: "open" },
    { id: "c", top: 300, state: "current" },
    { id: "d", top: 306, state: "open" }
  ]);

  assert.deepEqual(
    pins.map((pin) => [pin.state, pin.count, pin.ids]),
    [
      ["stack", 2, ["a", "b"]],
      ["current", 2, ["c", "d"]]
    ]
  );
});

test("nearby spans from one multi-block thread do not inflate the thread count", () => {
  const pins = stacked([
    { id: "same", top: 100, state: "open" },
    { id: "same", top: 104, state: "open" }
  ]);

  assert.deepEqual(pins.map((pin) => [pin.count, pin.ids]), [[1, ["same"]]]);
});
