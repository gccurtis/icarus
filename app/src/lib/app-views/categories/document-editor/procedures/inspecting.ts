import type { ResolvedPos } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";

import type { Inspected, Selection } from "$representation/data/types/workspace/tab";
import type { InspectorView } from "$representation/data/types/workspace/views";

export type Signal = {
  readonly key: InspectorView;
  readonly selection: Selection;
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
