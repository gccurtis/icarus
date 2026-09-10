import { expect, test } from "vitest";
import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { heldSelection, HELD } from "$app-views/categories/document-editor/procedures/highlight";
import {
  MultiSelection,
  multiSelection
} from "$app-views/categories/document-editor/procedures/multi-selection";
import {
  restoreSelection,
  selectionBookmark
} from "$app-views/categories/document-editor/procedures/selection-bookmark";
import {
  bodyOf,
  docOf
} from "$app-views/categories/document-editor/procedures/projection";
import { positionOf } from "$app-views/categories/document-editor/procedures/projection-positions";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";

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
const METRICS = { charactersPerLine: 40, linesPerPage: 40 };

class NodeFocusEvent extends Event implements FocusEvent {
  readonly detail = 0;
  readonly relatedTarget = null;
  readonly view = null;
  readonly which = 0;

  initUIEvent(): void {}
}

const at = (state: EditorState, blockId: string, offset: number): number => {
  const found = positionOf(state.doc, { blockId, offset });
  if (found === undefined) throw new Error(`No ${blockId} in the projection.`);
  return found;
};

const stateOf = () =>
  EditorState.create({ doc: docOf(BODY, METRICS), plugins: [heldSelection(), multiSelection()] });

test("typing over a multi-selection replaces every range", () => {
  let state = stateOf();
  state = state.apply(
    state.tr.setSelection(
      MultiSelection.create(state.doc, [
        [at(state, "#b1", 0), at(state, "#b1", 5)],
        [at(state, "#b2", 0), at(state, "#b2", 4)]
      ])
    )
  );

  const changed = state.apply(state.tr.insertText("X"));
  const body = bodyOf(changed.doc, BODY);
  const displays = body.rows.map((row) =>
    row.kind === "blocks" && row.blocks[0].type === "text" ? row.blocks[0].display : ""
  );

  expect(displays).toEqual([" the exposure sits", "X it would cost"]);
});

test("a multi-range, its primary direction, and held highlight survive a full repaint", () => {
  let before = stateOf();
  const primary = [at(before, "#b2", 4), at(before, "#b2", 0)] as const;
  before = before.apply(
    before.tr.setSelection(
      MultiSelection.create(
        before.doc,
        [
          [at(before, "#b1", 6), at(before, "#b1", 18)],
          primary
        ],
        primary[0],
        primary[1]
      )
    )
  );
  before = before.apply(before.tr.setMeta(HELD, true));

  const bookmark = selectionBookmark(before);
  const repainted = restoreSelection(
    EditorState.create({ doc: docOf(BODY, METRICS), plugins: [heldSelection(), multiSelection()] }),
    bookmark
  );

  expect(repainted.selection).toBeInstanceOf(MultiSelection);
  expect(repainted.selection.ranges).toHaveLength(2);
  expect(repainted.selection.anchor).toBe(at(repainted, "#b2", 4));
  expect(repainted.selection.head).toBe(at(repainted, "#b2", 0));
  expect(HELD.getState(repainted)).toBe(true);
});

test("a backward text selection keeps its direction through a repaint", () => {
  let before = stateOf();
  before = before.apply(
    before.tr.setSelection(
      TextSelection.create(before.doc, at(before, "#b1", 18), at(before, "#b1", 6))
    )
  );

  const repainted = restoreSelection(stateOf(), selectionBookmark(before));
  expect(repainted.selection.anchor).toBe(at(repainted, "#b1", 18));
  expect(repainted.selection.head).toBe(at(repainted, "#b1", 6));
});

test("focus transitions synchronously update the held-selection plugin", () => {
  const plugin = heldSelection();
  let state = EditorState.create({ doc: docOf(BODY, METRICS), plugins: [plugin] });
  const heldView = {
    state,
    dispatch: (transaction: Transaction) => {
      state = state.apply(transaction);
      heldView.state = state;
    }
  };
  const view = heldView as unknown as EditorView;
  const blur = plugin.props.handleDOMEvents?.blur;
  const focus = plugin.props.handleDOMEvents?.focus;

  expect(blur?.call(plugin, view, new NodeFocusEvent("blur"))).toBe(false);
  expect(HELD.getState(state)).toBe(true);
  expect(focus?.call(plugin, view, new NodeFocusEvent("focus"))).toBe(false);
  expect(HELD.getState(state)).toBe(false);
});
