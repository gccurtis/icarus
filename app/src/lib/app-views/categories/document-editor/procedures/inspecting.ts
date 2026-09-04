import type { ResolvedPos } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

import type { DocumentBody } from "$representation/data/types/documents/body";
import type { Inspected, Selection } from "$representation/data/types/workspace/tab";
import type { InspectorView } from "$representation/data/types/workspace/views";

export type Signal = {
  readonly key: InspectorView;
  readonly selection: Selection;
};

export type Address = {
  readonly blockId: string;
  readonly offset: number;
};

const atomAt = ($at: ResolvedPos): string | undefined => {
  const block = $at.parent;
  if (block.type.name !== "text_block") return undefined;

  const { blockId, atomId } = block.attrs;
  if (typeof blockId !== "string" || typeof atomId !== "string") return undefined;

  return `${blockId}/atoms/${atomId}@${$at.parentOffset}`;
};

export const signalOf = (state: EditorState): Signal | undefined => {
  const { $from, $to, empty } = state.selection;

  const from = atomAt($from);
  if (from === undefined) return undefined;

  if (!empty) {
    const to = atomAt($to);
    if (to === undefined) return undefined;

    return {
      key: "document-editor.text-selection",
      selection: { kind: "text-selection", id: from, at: to }
    };
  }

  return $from.parent.content.size === 0
    ? { key: "document-editor.empty-block", selection: { kind: "empty-block", id: from } }
    : { key: "document-editor.next-letter", selection: { kind: "next-letter", id: from } };
};

export const addressOf = (held: string): Address | undefined => {
  const [path, at] = held.split("@");
  if (path === undefined || at === undefined) return undefined;

  const blockId = path.split("/")[0];
  const offset = Number(at);
  if (blockId.length === 0 || !Number.isInteger(offset)) return undefined;

  return { blockId, offset };
};

const displayOf = (body: DocumentBody, blockId: string): string | undefined => {
  for (const row of body.rows) {
    if (row.kind !== "blocks") continue;

    for (const block of row.blocks) {
      if (block.id !== blockId) continue;
      return block.type === "text" ? block.display : undefined;
    }
  }

  return undefined;
};

export const selectedText = (
  body: DocumentBody | undefined,
  selection: Selection | undefined
): string | undefined => {
  if (body === undefined || selection === undefined) return undefined;

  const from = addressOf(selection.id);
  if (from === undefined) return undefined;

  const head = displayOf(body, from.blockId);
  if (head === undefined) return undefined;

  const to = selection.at === undefined ? undefined : addressOf(selection.at);
  if (to === undefined) return "";
  if (to.blockId === from.blockId) return head.slice(from.offset, to.offset);

  const tail = displayOf(body, to.blockId);
  if (tail === undefined) return head.slice(from.offset);

  return `${head.slice(from.offset)} … ${tail.slice(0, to.offset)}`;
};

export const worthSending = (
  signal: Signal,
  inspected: Inspected,
  held: Selection | undefined
): boolean => {
  if (inspected !== signal.key) return true;
  if (signal.key === "document-editor.next-letter") return false;

  return (
    held?.kind !== signal.selection.kind ||
    held.id !== signal.selection.id ||
    held.at !== signal.selection.at
  );
};
