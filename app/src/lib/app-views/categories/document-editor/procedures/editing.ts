import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";

import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { schema } from "$app-views/categories/document-editor/procedures/schema";

const spanOf = (doc: ProseMirrorNode, at: number): readonly [number, number] => {
  const row = doc.nodeAt(at);
  if (row === null) throw new Error(`No row sits at ${at}.`);

  const $at = doc.resolve(at);
  const page = $at.parent;

  return page.childCount === 1
    ? [$at.before(), $at.before() + page.nodeSize]
    : [at, at + row.nodeSize];
};

const previousRowAt = (doc: ProseMirrorNode, rowStart: number): number | undefined => {
  const $rowStart = doc.resolve(rowStart);

  if ($rowStart.nodeBefore !== null) return rowStart - $rowStart.nodeBefore.nodeSize;

  const pageStart = $rowStart.before();
  const priorPage = doc.resolve(pageStart).nodeBefore;
  if (priorPage === null) return undefined;

  const last = priorPage.lastChild;
  if (last === null) return undefined;

  return pageStart - last.nodeSize - 1;
};

export const splitRow: Command = (state, dispatch) => {
  const tr = state.tr;
  if (!state.selection.empty) tr.deleteSelection();

  const $from = tr.selection.$from;
  const block = $from.parent;
  if (block.type.name !== "text_block") return false;
  if ($from.node(-1).type.name !== "blocks_row") return false;

  if (dispatch === undefined) return true;

  const offset = $from.parentOffset;
  const tail = block.textContent.slice(offset);
  const rowEnd = $from.after(-1);

  if (offset < block.content.size) tr.delete($from.pos, $from.end());

  const at = tr.mapping.map(rowEnd);
  tr.insert(
    at,
    schema.node("blocks_row", { rowId: mint("row"), proportions: null }, [
      schema.node(
        "text_block",
        { blockId: mint("block"), atomId: mint("atom"), share: 1 },
        tail.length === 0 ? undefined : schema.text(tail)
      )
    ])
  );

  tr.setSelection(TextSelection.create(tr.doc, at + 2));
  dispatch(tr.scrollIntoView());

  return true;
};

export const mergeRow: Command = (state, dispatch) => {
  const { selection, doc } = state;
  if (!selection.empty) return false;

  const $from = selection.$from;
  if ($from.parent.type.name !== "text_block") return false;
  if ($from.parentOffset !== 0) return false;
  if ($from.index(-1) !== 0) return false;
  if ($from.node(-1).type.name !== "blocks_row") return false;

  const rowStart = $from.before(-1);
  const previousStart = previousRowAt(doc, rowStart);
  if (previousStart === undefined) return false;

  const previous = doc.nodeAt(previousStart);
  if (previous === null) return false;

  const target = previous.lastChild;
  if (target === null || target.type.name !== "text_block") return false;

  if (dispatch === undefined) return true;

  const joinAt = previousStart + previous.nodeSize - 2;
  const text = $from.parent.textContent;
  const [from, to] = spanOf(doc, rowStart);

  const tr = state.tr.delete(from, to);
  if (text.length > 0) tr.insertText(text, joinAt);
  tr.setSelection(TextSelection.create(tr.doc, joinAt));

  dispatch(tr.scrollIntoView());

  return true;
};
