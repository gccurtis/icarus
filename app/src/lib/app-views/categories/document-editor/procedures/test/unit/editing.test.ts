import assert from "node:assert/strict";
import { test } from "vitest";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import { mergeRow, splitRow } from "$app-views/categories/document-editor/procedures/editing";
import { bodyOf, docOf } from "$app-views/categories/document-editor/procedures/projection";
import { translate } from "$app-views/categories/document-editor/procedures/translate";

const WIDE = { charactersPerLine: 40, linesPerPage: 40 };
const TIGHT = { charactersPerLine: 40, linesPerPage: 1 };

const text = (id: string, display: string, over: Partial<TextBlock> = {}): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: [],
  ...over
});

const blocks = (id: string, held: ContentBlock[], proportions?: number[]): DocumentRow => ({
  id,
  kind: "blocks",
  blocks: held,
  ...(proportions === undefined ? {} : { proportions })
});

const body = (rows: DocumentRow[]): DocumentBody => ({ rows });

const caret = (doc: ProseMirrorNode, blockId: string, offset: number): number => {
  let found: number | undefined;
  doc.descendants((node, at) => {
    if (node.type.name === "text_block" && node.attrs.blockId === blockId) found = at + 1 + offset;
  });

  if (found === undefined) throw new Error(`No block ${blockId} in the doc.`);
  return found;
};

const stateAt = (
  before: DocumentBody,
  blockId: string,
  offset: number,
  metrics = WIDE
): EditorState => {
  const doc = docOf(before, metrics);
  return EditorState.create({ doc, selection: TextSelection.create(doc, caret(doc, blockId, offset)) });
};

const run = (
  command: typeof splitRow,
  state: EditorState
): { handled: boolean; doc: ProseMirrorNode } => {
  let next = state;
  const handled = command(state, (tr) => {
    next = state.apply(tr);
  });

  return { handled, doc: next.doc };
};

const displays = (after: DocumentBody): readonly string[][] =>
  after.rows.map((row) =>
    row.kind === "blocks" ? row.blocks.map((block) => ("display" in block ? block.display : "")) : []
  );

test("Enter mid-block moves the tail into a new row below", () => {
  const before = body([blocks("#r1", [text("#b1", "OneTwo")])]);
  const { handled, doc } = run(splitRow, stateAt(before, "#b1", 3));
  const after = bodyOf(doc, before);

  assert.equal(handled, true);
  assert.deepEqual(displays(after), [["One"], ["Two"]]);
  assert.equal(after.rows[0].id, "#r1");
  assert.notEqual(after.rows[1].id, "#r1");
});

test("Enter at the end leaves an empty row to type into", () => {
  const before = body([blocks("#r1", [text("#b1", "One")])]);
  const after = bodyOf(run(splitRow, stateAt(before, "#b1", 3)).doc, before);

  assert.deepEqual(displays(after), [["One"], [""]]);
});

test("Enter at the start pushes the text down and leaves an empty row above", () => {
  const before = body([blocks("#r1", [text("#b1", "One")])]);
  const after = bodyOf(run(splitRow, stateAt(before, "#b1", 0)).doc, before);

  assert.deepEqual(displays(after), [[""], ["One"]]);
});

test("a split keeps the head's block id and mints the tail's", () => {
  const before = body([blocks("#r1", [text("#b1", "OneTwo")])]);
  const after = bodyOf(run(splitRow, stateAt(before, "#b1", 3)).doc, before);
  const [head, tail] = after.rows;

  assert.equal(head.kind === "blocks" && head.blocks[0].id, "#b1");
  assert.equal(tail.kind === "blocks" && tail.blocks[0].id !== "#b1", true);
});

test("a split makes a paragraph, whatever the row it came from was", () => {
  const before = body([blocks("#r1", [text("#b1", "TitleRest", { variant: "heading" })])]);
  const after = bodyOf(run(splitRow, stateAt(before, "#b1", 5)).doc, before);

  assert.equal(after.rows[1].kind === "blocks" && after.rows[1].blocks[0].type === "text"
    ? after.rows[1].blocks[0].variant
    : undefined, "paragraph");
});

test("splitting inside a proportioned row leaves the sibling where it is", () => {
  const before = body([blocks("#r1", [text("#b1", "TitleMore"), text("#b2", "Date")], [2, 1])]);
  const after = bodyOf(run(splitRow, stateAt(before, "#b1", 5)).doc, before);

  assert.deepEqual(displays(after), [["Title", "Date"], ["More"]]);
  assert.deepEqual(after.rows[0].kind === "blocks" ? after.rows[0].proportions : undefined, [2, 1]);
  assert.equal(after.rows[1].kind === "blocks" && after.rows[1].proportions, undefined);
});

test("a split translates to one text op and one row insert", () => {
  const before = body([blocks("#r1", [text("#b1", "OneTwo")])]);
  const after = bodyOf(run(splitRow, stateAt(before, "#b1", 3)).doc, before);

  assert.deepEqual(
    translate(before, after).map((op) => op.op),
    ["text", "insert"]
  );
});

test("Backspace at a row start joins it onto the row above", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]);
  const { handled, doc } = run(mergeRow, stateAt(before, "#b2", 0));
  const after = bodyOf(doc, before);

  assert.equal(handled, true);
  assert.deepEqual(displays(after), [["OneTwo"]]);
  assert.equal(after.rows.length, 1);
  assert.equal(after.rows[0].id, "#r1");
});

test("a merge translates to one text op and one row remove", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]);
  const after = bodyOf(run(mergeRow, stateAt(before, "#b2", 0)).doc, before);

  assert.deepEqual(
    translate(before, after).map((op) => op.op),
    ["text", "remove"]
  );
});

test("merging an empty row just removes it", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "")])]);
  const after = bodyOf(run(mergeRow, stateAt(before, "#b2", 0)).doc, before);

  assert.deepEqual(displays(after), [["One"]]);
});

test("Backspace on the first row is not a merge", () => {
  const before = body([blocks("#r1", [text("#b1", "One")])]);

  assert.equal(run(mergeRow, stateAt(before, "#b1", 0)).handled, false);
});

test("Backspace mid-text is not a merge", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]);

  assert.equal(run(mergeRow, stateAt(before, "#b2", 1)).handled, false);
});

test("Backspace in a row's second block is not a merge", () => {
  const before = body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")], [1, 1])]);

  assert.equal(run(mergeRow, stateAt(before, "#b2", 0)).handled, false);
});

test("a merge joins the rows either side of a row the editor cannot draw", () => {
  const before = body([
    blocks("#r1", [text("#b1", "One")]),
    { id: "#r2", kind: "divider" },
    blocks("#r3", [text("#b3", "Two")])
  ]);
  const after = bodyOf(run(mergeRow, stateAt(before, "#b3", 0)).doc, before);

  assert.deepEqual(
    after.rows.map((row) => row.id),
    ["#r1", "#r2"],
    "the divider is untouched, and the row that merged away is gone"
  );
  assert.deepEqual(displays(after), [["OneTwo"], []]);
});

test("a merge reaches across a computed page boundary", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]);
  const state = stateAt(before, "#b2", 0, TIGHT);

  assert.equal(state.doc.childCount, 2);

  const after = bodyOf(run(mergeRow, state).doc, before);

  assert.deepEqual(displays(after), [["OneTwo"]]);
});

test("a split reaching across a page boundary keeps both rows", () => {
  const before = body([blocks("#r1", [text("#b1", "OneTwo")]), blocks("#r2", [text("#b2", "X")])]);
  const state = stateAt(before, "#b1", 3, TIGHT);
  const after = bodyOf(run(splitRow, state).doc, before);

  assert.deepEqual(displays(after), [["One"], ["Two"], ["X"]]);
});
