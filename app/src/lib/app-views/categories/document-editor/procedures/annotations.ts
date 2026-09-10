import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Anchored } from "$app-views/categories/document-editor/procedures/comment-anchors";
import {
  anchorAt,
  displayOffsetOf,
  positionOf
} from "$app-views/categories/document-editor/procedures/projection";

export type Annotations = {
  readonly anchored: readonly Anchored[];
  readonly current: string | undefined;
};

export const ANNOTATIONS = new PluginKey<Annotations>("document-editor.annotations");

const NONE: Annotations = { anchored: [], current: undefined };

export const sameAnnotations = (a: Annotations | undefined, b: Annotations): boolean =>
  a !== undefined &&
  a.current === b.current &&
  a.anchored.length === b.anchored.length &&
  a.anchored.every(
    (held, index) =>
      held.thread._id === b.anchored[index].thread._id &&
      held.blockId === b.anchored[index].blockId &&
      held.from === b.anchored[index].from &&
      held.to === b.anchored[index].to
  );

export type Span = {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly current: boolean;
};

export const spansOf = (doc: ProseMirrorNode, annotations: Annotations): Span[] => {
  const spans: Span[] = [];

  for (const held of annotations.anchored) {
    const from = positionOf(doc, { blockId: held.blockId, offset: held.from });
    const to = positionOf(doc, { blockId: held.blockId, offset: held.to });
    if (from === undefined || to === undefined) continue;

    spans.push({
      id: held.thread._id,
      from: Math.min(from, to),
      to: Math.max(from, to),
      current: annotations.current === held.thread._id
    });
  }

  return spans;
};

const mappedAnchors = (transaction: Transaction, annotations: Annotations): Anchored[] => {
  const anchored: Anchored[] = [];

  for (const held of annotations.anchored) {
    const oldFrom = positionOf(transaction.before, { blockId: held.blockId, offset: held.from });
    const oldTo = positionOf(transaction.before, { blockId: held.blockId, offset: held.to });
    if (oldFrom === undefined || oldTo === undefined) continue;

    if (oldFrom === oldTo) {
      const mapped = transaction.mapping.map(oldFrom, 1);
      const point = anchorAt(transaction.doc.resolve(mapped));
      if (point !== undefined) {
        anchored.push({ ...held, blockId: point.blockId, from: point.offset, to: point.offset });
      }
      continue;
    }

    const from = transaction.mapping.map(Math.min(oldFrom, oldTo), 1);
    const to = transaction.mapping.map(Math.max(oldFrom, oldTo), -1);

    if (from >= to) {
      const point = anchorAt(transaction.doc.resolve(from));
      if (point !== undefined) {
        anchored.push({ ...held, blockId: point.blockId, from: point.offset, to: point.offset });
      }
      continue;
    }

    transaction.doc.descendants((node, at) => {
      if (node.type.name !== "text_block") return;
      const contentFrom = at + 1;
      const contentTo = contentFrom + node.content.size;
      const overlapFrom = Math.max(Math.min(from, to), contentFrom);
      const overlapTo = Math.min(Math.max(from, to), contentTo);
      if (overlapFrom >= overlapTo) return;

      anchored.push({
        thread: held.thread,
        blockId: node.attrs.blockId as string,
        from: displayOffsetOf(node, overlapFrom - contentFrom),
        to: displayOffsetOf(node, overlapTo - contentFrom)
      });
    });
  }

  return anchored;
};

const collapsed = (span: Span) => (): HTMLElement => {
  const marker = document.createElement("span");
  marker.className = span.current
    ? "comment-anchor comment-collapsed comment-current"
    : "comment-anchor comment-collapsed";
  marker.dataset.thread = span.id;
  marker.setAttribute("aria-hidden", "true");
  return marker;
};

export const annotationDecorations = (state: EditorState): DecorationSet => {
  const annotations = ANNOTATIONS.getState(state) ?? NONE;
  if (annotations.anchored.length === 0) return DecorationSet.empty;

  const decorations = spansOf(state.doc, annotations).map((span) =>
    span.from === span.to
      ? Decoration.widget(span.from, collapsed(span), {
          side: 1,
          key: `collapsed:${span.id}:${span.from}`,
          ignoreSelection: true
        })
      : Decoration.inline(
          span.from,
          span.to,
          {
            class: span.current ? "comment-anchor comment-current" : "comment-anchor",
            "data-thread": span.id
          },
          { inclusiveStart: false, inclusiveEnd: false }
        )
  );

  return DecorationSet.create(state.doc, decorations);
};

export const annotationsPlugin = (read: () => Annotations): Plugin<Annotations> =>
  new Plugin<Annotations>({
    key: ANNOTATIONS,
    state: {
      init: () => read(),
      apply: (transaction, held) => {
        const next = transaction.getMeta(ANNOTATIONS) as Annotations | undefined;
        if (next !== undefined) return next;
        return transaction.docChanged
          ? { ...held, anchored: mappedAnchors(transaction, held) }
          : held;
      }
    },
    props: {
      decorations: annotationDecorations
    }
  });

export type PinState = "open" | "current" | "stack" | "detached" | "resolved";

export type Pin = {
  readonly id: string;
  readonly top: number;
  readonly state: PinState;
  readonly count: number;
  readonly ids: readonly string[];
};

const STACK_WITHIN = 14;

export const stacked = (
  pins: readonly { id: string; top: number; state: PinState }[]
): Pin[] => {
  const sorted = [...pins].sort((a, b) => a.top - b.top);
  const out: Pin[] = [];

  for (const pin of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && pin.top - last.top < STACK_WITHIN) {
      if (last.ids.includes(pin.id)) continue;
      const ids = [...last.ids, pin.id];
      const current = last.state === "current" || pin.state === "current";
      out[out.length - 1] = {
        ...last,
        ids,
        count: ids.length,
        state: current ? "current" : "stack"
      };
      continue;
    }
    out.push({ id: pin.id, top: pin.top, state: pin.state, count: 1, ids: [pin.id] });
  }

  return out;
};
