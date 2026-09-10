import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { withFreshMarkIds } from "$app-views/categories/document-editor/procedures/projection-positions";
import { schema } from "$app-views/categories/document-editor/procedures/schema";
import {
  DEFAULT_STYLES,
  inlineStyleOf
} from "$app-views/categories/document-editor/procedures/styles";

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
  let previous: number | undefined;

  doc.descendants((node, at, parent) => {
    if (at >= rowStart) return false;
    if (node.type.spec.group?.split(" ").includes("row") !== true) return;

    if (parent?.type.name === "page") previous = at;
  });

  return previous;
};

const BODY_ATTRS = {
  kind: "text",
  variant: "paragraph",
  level: null,
  listStyle: null,
  checked: null,
  language: null,
  styleKey: null,
  format: null
};

const bodyPresentation = () => {
  const body = DEFAULT_STYLES.styles[DEFAULT_STYLES.defaultKey];
  return {
    ...BODY_ATTRS,
    presentation: inlineStyleOf(body),
    fontSize: body.fontSize ?? 16,
    lineHeight: body.lineHeight ?? 26,
    spaceBefore: body.spaceBefore ?? 0,
    spaceAfter: body.spaceAfter ?? 0
  };
};

const continuation = (block: ProseMirrorNode) => {
  if (block.attrs.variant !== "list") return bodyPresentation();

  return {
    ...BODY_ATTRS,
    variant: "list",
    listStyle: block.attrs.listStyle,
    checked: block.attrs.listStyle === "todo" ? false : block.attrs.checked,
    styleKey: block.attrs.styleKey,
    format: block.attrs.format,
    presentation: block.attrs.presentation,
    fontSize: block.attrs.fontSize,
    lineHeight: block.attrs.lineHeight,
    spaceBefore: block.attrs.spaceBefore,
    spaceAfter: block.attrs.spaceAfter
  };
};

const visibleCaret = (view: EditorView | undefined): number | undefined => {
  if (view === undefined || !view.hasFocus()) return undefined;

  const selection = view.dom.ownerDocument.getSelection();
  const node = selection?.anchorNode;
  if (
    selection?.isCollapsed !== true ||
    node === null ||
    node === undefined ||
    !view.dom.contains(node)
  ) return undefined;

  try {
    return view.posAtDOM(node, selection.anchorOffset);
  } catch {
    return undefined;
  }
};

export const splitRow: Command = (state, dispatch, view) => {
  const tr = state.tr;
  const caret = state.selection.empty ? visibleCaret(view) : undefined;
  if (caret !== undefined && caret !== tr.selection.from) {
    tr.setSelection(TextSelection.create(tr.doc, caret));
  }
  if (!state.selection.empty) tr.deleteSelection();

  const $from = tr.selection.$from;
  const block = $from.parent;
  if (block.type.name !== "text_block") return false;
  if ($from.node(-1).type.name !== "blocks_row") return false;

  if (dispatch === undefined) return true;

  const offset = $from.parentOffset;
  const tail: ProseMirrorNode[] = [];
  block.content.cut(offset).forEach((node) => tail.push(node));
  const rowEnd = $from.after(-1);

  if (offset < block.content.size) tr.delete($from.pos, $from.end());

  const at = tr.mapping.map(rowEnd);
  tr.insert(
    at,
    schema.node("blocks_row", { rowId: mint("row"), proportions: null }, [
      schema.node(
        "text_block",
        {
          ...continuation(block),
          blockId: mint("block"),
          atomIds: [mint("atom")],
          share: 1
        },
        withFreshMarkIds(tail)
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

  if (previous.type.name !== "blocks_row") {
    if (dispatch === undefined) return true;

    const [gone, until] = spanOf(doc, previousStart);
    const tr = state.tr.delete(gone, until);
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map($from.pos)));
    dispatch(tr.scrollIntoView());
    return true;
  }

  const target = previous.lastChild;
  if (target === null || target.type.name !== "text_block") return false;

  if (dispatch === undefined) return true;

  const joinAt = previousStart + previous.nodeSize - 2;
  const content = $from.parent.content;
  const [from, to] = spanOf(doc, rowStart);

  const tr = state.tr.delete(from, to);
  if (content.size > 0) tr.insert(joinAt, content);
  tr.setSelection(TextSelection.create(tr.doc, joinAt));

  dispatch(tr.scrollIntoView());

  return true;
};
