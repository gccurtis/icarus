import {
  AllSelection,
  NodeSelection,
  TextSelection,
  type EditorState,
  type Selection
} from "prosemirror-state";

import { HELD } from "$app-views/categories/document-editor/procedures/highlight";
import {
  MultiSelection,
  isMulti
} from "$app-views/categories/document-editor/procedures/multi-selection";
import {
  anchorAt,
  positionOf,
  type Anchor
} from "$app-views/categories/document-editor/procedures/projection";

type RangeBookmark = { readonly from: Anchor; readonly to: Anchor };

export type SelectionBookmark =
  | {
      readonly kind: "text" | "multi";
      readonly anchor: Anchor;
      readonly head: Anchor;
      readonly ranges: readonly RangeBookmark[];
      readonly held: boolean;
    }
  | { readonly kind: "node"; readonly blockId: string; readonly held: boolean }
  | { readonly kind: "all"; readonly held: boolean };

const point = (selection: Selection, side: "anchor" | "head"): Anchor | undefined =>
  anchorAt(side === "anchor" ? selection.$anchor : selection.$head);

export const selectionBookmark = (state: EditorState): SelectionBookmark | undefined => {
  const { selection } = state;
  const held = HELD.getState(state) === true;

  if (selection instanceof AllSelection) return { kind: "all", held };
  if (selection instanceof NodeSelection) {
    const blockId = selection.node.attrs.blockId;
    return typeof blockId === "string" ? { kind: "node", blockId, held } : undefined;
  }

  const anchor = point(selection, "anchor");
  const head = point(selection, "head");
  if (anchor === undefined || head === undefined) return undefined;

  const ranges = selection.ranges.flatMap((range) => {
    const from = anchorAt(range.$from);
    const to = anchorAt(range.$to);
    return from === undefined || to === undefined ? [] : [{ from, to }];
  });
  if (ranges.length === 0) return undefined;

  return { kind: isMulti(selection) ? "multi" : "text", anchor, head, ranges, held };
};

const nodePosition = (state: EditorState, blockId: string): number | undefined => {
  let found: number | undefined;
  state.doc.descendants((node, at) => {
    if (found !== undefined) return false;
    if (node.attrs.blockId !== blockId) return;
    found = at;
    return false;
  });
  return found;
};

export const restoreSelection = (
  state: EditorState,
  bookmark: SelectionBookmark | undefined
): EditorState => {
  if (bookmark === undefined) return state;

  let selection: Selection | undefined;
  if (bookmark.kind === "all") {
    selection = new AllSelection(state.doc);
  } else if (bookmark.kind === "node") {
    const at = nodePosition(state, bookmark.blockId);
    if (at !== undefined) selection = NodeSelection.create(state.doc, at);
  } else {
    const anchor = positionOf(state.doc, bookmark.anchor);
    const head = positionOf(state.doc, bookmark.head);
    const ranges = bookmark.ranges.flatMap(({ from, to }) => {
      const a = positionOf(state.doc, from);
      const b = positionOf(state.doc, to);
      return a === undefined || b === undefined ? [] : [[a, b] as const];
    });

    if (anchor !== undefined && head !== undefined && ranges.length > 0) {
      selection =
        bookmark.kind === "multi"
          ? MultiSelection.create(state.doc, ranges, anchor, head)
          : TextSelection.create(state.doc, anchor, head);
    }
  }

  if (selection === undefined) return state;
  return state.apply(
    state.tr
      .setSelection(selection)
      .setMeta(HELD, bookmark.held)
      .setMeta("addToHistory", false)
      .setMeta("document-editor.layout", true)
  );
};
