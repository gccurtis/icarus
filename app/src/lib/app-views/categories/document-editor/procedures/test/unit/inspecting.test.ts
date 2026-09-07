import assert from "node:assert/strict";
import { test } from "vitest";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import {
  addressOf,
  selectedText,
  selectedTexts,
  signalOf,
  worthSending
} from "$app-views/categories/document-editor/procedures/inspecting";
import { docOf } from "$app-views/categories/document-editor/procedures/projection";

const METRICS = { charactersPerLine: 40, linesPerPage: 40 };

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const blocks = (id: string, held: ContentBlock[]): DocumentRow => ({
  id,
  kind: "blocks",
  blocks: held
});

const body = (rows: DocumentRow[]): DocumentBody => ({ rows });

const positionOf = (doc: ProseMirrorNode, blockId: string, offset: number): number => {
  let found: number | undefined;
  doc.descendants((node, at) => {
    if (node.type.name === "text_block" && node.attrs.blockId === blockId) found = at + 1 + offset;
  });

  if (found === undefined) throw new Error(`No block ${blockId} in the doc.`);
  return found;
};

const stateOver = (
  held: DocumentBody,
  from: readonly [string, number],
  to: readonly [string, number] = from
): EditorState => {
  const doc = docOf(held, METRICS);

  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, positionOf(doc, ...from), positionOf(doc, ...to))
  });
};

const ONE = body([blocks("#r1", [text("#b1", "Where the exposure sits")])]);

const TWO = body([
  blocks("#r1", [text("#b1", "Where the exposure sits")]),
  blocks("#r2", [text("#b2", "What it would cost")])
]);

const EMPTY = body([blocks("#r1", [text("#b1", "")])]);

test("selecting a Prompt Block opens its dedicated inspector", () => {
  const held = body([
    blocks("#r1", [
      text("#b1", "Source"),
      {
        id: "#prompt",
        type: "prompt",
        derivedOutputId: "derivedOutputs:7" as Id<"derivedOutputs">,
        atoms: [],
        display: "",
        marks: [],
        state: "idle"
      }
    ])
  ]);
  const doc = docOf(held, METRICS);
  let at: number | undefined;
  doc.descendants((node, position) => {
    if (node.type.name === "prompt_block") at = position;
  });
  if (at === undefined) throw new Error("No Prompt Block in projected document");

  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, at) });

  assert.deepEqual(signalOf(state), {
    key: "document-editor.prompt-block",
    selection: { kind: "prompt", id: "#prompt" }
  });
});

test("a selection inside one block names the atom at each end", () => {
  assert.deepEqual(signalOf(stateOver(ONE, ["#b1", 6], ["#b1", 18])), {
    key: "document-editor.text-selection",
    selection: {
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@6",
      at: "#b1/atoms/#b1-atom@18"
    }
  });
});

test("a selection crossing two blocks names the atom it starts in and the one it ends in", () => {
  assert.deepEqual(signalOf(stateOver(TWO, ["#b1", 6], ["#b2", 4])), {
    key: "document-editor.text-selection",
    selection: {
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@6",
      at: "#b2/atoms/#b2-atom@4"
    }
  });
});

test("a caret in a block with text is where the next letter goes, and carries no range", () => {
  const found = signalOf(stateOver(ONE, ["#b1", 6]));

  assert.deepEqual(found, {
    key: "document-editor.next-letter",
    selection: { kind: "next-letter", id: "#b1/atoms/#b1-atom@6" }
  });
  assert.equal(found?.selection.at, undefined);
});

test("a caret in a block with nothing in it is an empty line", () => {
  assert.deepEqual(signalOf(stateOver(EMPTY, ["#b1", 0])), {
    key: "document-editor.empty-line",
    selection: { kind: "empty-line", id: "#b1/atoms/#b1-atom@0" }
  });
});

test("the next letter is sent when the caret moves so inline context stays current", () => {
  const found = signalOf(stateOver(ONE, ["#b1", 6]));
  if (found === undefined) throw new Error("no signal");

  assert.equal(worthSending(found, "document-editor.next-letter", found.selection), false);
  assert.equal(
    worthSending(found, "document-editor.next-letter", {
      kind: "next-letter",
      id: "#b1/atoms/#b1-atom@2"
    }),
    true,
    "moving within the block can cross a comment or link boundary"
  );
  assert.equal(
    worthSending(found, "document-editor.next-letter", {
      kind: "next-letter",
      id: "#b2/atoms/#b2-atom@2"
    }),
    true,
    "a different block can resolve to a different named style"
  );
});

test("the next letter is sent when the inspector is showing something else", () => {
  const found = signalOf(stateOver(ONE, ["#b1", 6]));
  if (found === undefined) throw new Error("no signal");

  assert.equal(worthSending(found, "empty", undefined), true);
  assert.equal(
    worthSending(found, "document-editor.text-selection", {
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@6",
      at: "#b1/atoms/#b1-atom@18"
    }),
    true
  );
});

test("a selection that says what the inspector already says is not sent again", () => {
  const found = signalOf(stateOver(ONE, ["#b1", 6], ["#b1", 18]));
  if (found === undefined) throw new Error("no signal");

  assert.equal(worthSending(found, found.key, found.selection), false);
  assert.equal(
    worthSending(found, found.key, { ...found.selection, at: "#b1/atoms/#b1-atom@19" }),
    true,
    "a range that has moved is news"
  );
});

test("a secondary-range change is sent even when the primary range is unchanged", () => {
  const found = signalOf(stateOver(ONE, ["#b1", 6], ["#b1", 18]));
  if (found === undefined) throw new Error("no signal");

  assert.equal(
    worthSending(
      {
        ...found,
        selection: {
          ...found.selection,
          ranges: [{ id: "#b2/atoms/#b2-atom@0", at: "#b2/atoms/#b2-atom@4" }]
        }
      },
      found.key,
      found.selection
    ),
    true
  );
});

test("an address is the block, the atom, and the offset into that atom", () => {
  assert.deepEqual(addressOf("#b1/atoms/#a1@12"), { blockId: "#b1", atomId: "#a1", offset: 12 });
  assert.equal(addressOf("#b1/atoms/#a1"), undefined, "an address with no offset is not one");
  assert.equal(addressOf("#b1/atoms/#a1@half"), undefined);
});

test("the selected text is sliced out of the block it sits in", () => {
  assert.equal(
    selectedText(ONE, { kind: "text-selection", id: "#b1/atoms/#b1-atom@6", at: "#b1/atoms/#b1-atom@18" }),
    "the exposure"
  );
});

test("a selection across two blocks joins the tail of one to the head of the other", () => {
  assert.equal(
    selectedText(TWO, { kind: "text-selection", id: "#b1/atoms/#b1-atom@6", at: "#b2/atoms/#b2-atom@4" }),
    "the exposure sits … What"
  );
});

test("disjoint selected text keeps one snippet per represented range", () => {
  assert.deepEqual(
    selectedTexts(TWO, {
      kind: "text-selection",
      id: "#b1/atoms/#b1-atom@6",
      at: "#b1/atoms/#b1-atom@18",
      ranges: [{ id: "#b2/atoms/#b2-atom@0", at: "#b2/atoms/#b2-atom@4" }]
    }),
    ["the exposure", "What"]
  );
});

test("a caret selects nothing, and says so as an empty string", () => {
  assert.equal(selectedText(ONE, { kind: "next-letter", id: "#b1/atoms/#b1-atom@6" }), "");
});

test("a block the body no longer holds resolves to nothing at all", () => {
  assert.equal(selectedText(ONE, { kind: "text-selection", id: "#bgone/atoms/#a@0" }), undefined);
  assert.equal(selectedText(undefined, { kind: "next-letter", id: "#b1/atoms/#b1-atom@0" }), undefined);
});
