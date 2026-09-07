import type { Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

import type { DocumentBody } from "$representation/data/types/documents/body";
import type { Inspected, Selection, SelectionRange } from "$representation/data/types/workspace/tab";
import type { InspectorView } from "$representation/data/types/workspace/views";
import {
  addressAt,
  linearOf,
  positionOf
} from "$app-views/categories/document-editor/procedures/projection";

export type Signal = {
  readonly key: InspectorView;
  readonly selection: Selection;
};

export type Address = {
  readonly blockId: string;
  readonly atomId: string;
  readonly offset: number;
};

export const atomAt = ($at: ResolvedPos): string | undefined => {
  const found = addressAt($at);
  if (found === undefined) return undefined;

  return `${found.blockId}/atoms/${found.atomId}@${found.offset}`;
};

const nodeSignal = (state: EditorState): Signal | undefined => {
  const node = "node" in state.selection ? (state.selection as { node: { type: { name: string }; attrs: Record<string, unknown> } }).node : undefined;
  if (node === undefined) return undefined;

  const blockId = node.attrs.blockId;
  if (typeof blockId !== "string") return undefined;

  if (node.type.name === "image_block") {
    return { key: "document-editor.image", selection: { kind: "image", id: blockId } };
  }
  if (node.type.name === "table_block") {
    return { key: "document-editor.table", selection: { kind: "table", id: blockId } };
  }
  if (node.type.name === "formula_block") {
    return { key: "document-editor.formula", selection: { kind: "formula", id: blockId } };
  }
  return undefined;
};

export const signalOf = (
  state: EditorState,
  ranges: readonly SelectionRange[] = []
): Signal | undefined => {
  const fromNode = nodeSignal(state);
  if (fromNode !== undefined) return fromNode;

  const { $from, $to, empty } = state.selection;

  const from = atomAt($from);
  if (from === undefined) return undefined;

  const extra = ranges.length === 0 ? {} : { ranges };

  if (!empty || ranges.length > 0) {
    const to = atomAt($to);
    if (to === undefined) return undefined;

    return {
      key: "document-editor.text-selection",
      selection: { kind: "text-selection", id: from, at: to, ...extra }
    };
  }

  return $from.parent.content.size === 0
    ? { key: "document-editor.empty-line", selection: { kind: "empty-line", id: from } }
    : { key: "document-editor.next-letter", selection: { kind: "next-letter", id: from } };
};

export const addressOf = (held: string): Address | undefined => {
  const [path, at] = held.split("@");
  if (path === undefined || at === undefined) return undefined;

  const [blockId, , atomId] = path.split("/");
  const offset = Number(at);
  if (blockId === undefined || blockId.length === 0 || !Number.isInteger(offset)) return undefined;

  return { blockId, atomId: atomId ?? "", offset };
};

const blockAt = (body: DocumentBody, blockId: string) => {
  for (const row of body.rows) {
    if (row.kind !== "blocks") continue;

    for (const block of row.blocks) {
      if (block.id !== blockId) continue;
      return block.type === "text" || block.type === "prompt" ? block : undefined;
    }
  }

  return undefined;
};

const linearAddress = (body: DocumentBody, address: Address): number | undefined => {
  const block = blockAt(body, address.blockId);
  if (block === undefined) return undefined;

  return linearOf(block.atoms, { atom: address.atomId, offset: address.offset });
};

export const selectedText = (
  body: DocumentBody | undefined,
  selection: Selection | undefined
): string | undefined => {
  if (body === undefined || selection === undefined) return undefined;

  const from = addressOf(selection.id);
  if (from === undefined) return undefined;

  const head = blockAt(body, from.blockId);
  if (head === undefined) return undefined;
  const start = linearAddress(body, from) ?? 0;

  const to = selection.at === undefined ? undefined : addressOf(selection.at);
  if (to === undefined) return "";

  if (to.blockId === from.blockId) {
    const end = linearAddress(body, to) ?? start;
    return head.display.slice(Math.min(start, end), Math.max(start, end));
  }

  const tail = blockAt(body, to.blockId);
  if (tail === undefined) return head.display.slice(start);

  return `${head.display.slice(start)} … ${tail.display.slice(0, linearAddress(body, to) ?? 0)}`;
};

export const selectedTexts = (
  body: DocumentBody | undefined,
  selection: Selection | undefined
): string[] => {
  if (body === undefined || selection === undefined) return [];

  return [
    { id: selection.id, at: selection.at },
    ...(selection.ranges ?? [])
  ].flatMap((range) => {
    const text = selectedText(body, { kind: "text-selection", ...range });
    return text === undefined ? [] : [text];
  });
};

const sameRanges = (a: readonly SelectionRange[] | undefined, b: readonly SelectionRange[] | undefined): boolean =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

const sameIds = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export const sameSelection = (a: Selection | undefined, b: Selection | undefined): boolean =>
  a === b || (
    a !== undefined &&
    b !== undefined &&
    a.kind === b.kind &&
    a.id === b.id &&
    a.at === b.at &&
    sameRanges(a.ranges, b.ranges) &&
    sameIds(a.ids, b.ids)
  );

export const worthSending = (
  signal: Signal,
  inspected: Inspected,
  held: Selection | undefined
): boolean => {
  if (inspected !== signal.key) return true;
  return !sameSelection(held, signal.selection);
};

export const positionOfAddress = (
  doc: ProseMirrorNode,
  body: DocumentBody,
  held: string
): number | undefined => {
  const address = addressOf(held);
  if (address === undefined) return undefined;

  const offset = linearAddress(body, address);
  if (offset === undefined) return undefined;

  return positionOf(doc, { blockId: address.blockId, offset });
};
