import type { Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  Selection,
  SelectionRange,
  TextSelection,
  type EditorState,
  type Transaction
} from "prosemirror-state";
import type { Mappable } from "prosemirror-transform";
import { Decoration, DecorationSet } from "prosemirror-view";

export type Span = readonly [number, number];

const ordered = (spans: readonly Span[]): Span[] => {
  const sorted = [...spans]
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as Span)
    .filter(([a, b]) => a < b)
    .sort((x, y) => x[0] - y[0]);

  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span[0] <= last[1]) {
      merged[merged.length - 1] = [last[0], Math.max(last[1], span[1])];
      continue;
    }
    merged.push(span);
  }

  return merged;
};

export class MultiSelection extends Selection {
  constructor($anchor: ResolvedPos, $head: ResolvedPos, ranges: readonly SelectionRange[]) {
    super($anchor, $head, [...ranges]);
  }

  static create(
    doc: ProseMirrorNode,
    spans: readonly Span[],
    anchor?: number,
    head?: number
  ): Selection {
    const merged = ordered(spans);
    if (merged.length === 0) return Selection.atStart(doc);
    if (merged.length === 1) return TextSelection.create(doc, merged[0][0], merged[0][1]);

    const low = anchor === undefined || head === undefined ? undefined : Math.min(anchor, head);
    const high = anchor === undefined || head === undefined ? undefined : Math.max(anchor, head);
    const found =
      low === undefined || high === undefined
        ? -1
        : merged.findIndex(([from, to]) => from <= low && to >= high);
    const index = found === -1 ? merged.length - 1 : found;
    const primary = merged[index];
    const $anchor = doc.resolve(found === -1 ? primary[0] : (anchor as number));
    const $head = doc.resolve(found === -1 ? primary[1] : (head as number));
    const ranges = [primary, ...merged.filter((_, at) => at !== index)].map(
      ([from, to]) => new SelectionRange(doc.resolve(from), doc.resolve(to))
    );

    return new MultiSelection($anchor, $head, ranges);
  }

  get spans(): Span[] {
    return this.ranges.map((range) => [range.$from.pos, range.$to.pos] as Span);
  }

  map(doc: ProseMirrorNode, mapping: Mappable): Selection {
    return MultiSelection.create(
      doc,
      this.spans.map(([from, to]) => [mapping.map(from), mapping.map(to)] as Span),
      mapping.map(this.anchor),
      mapping.map(this.head)
    );
  }

  eq(other: Selection): boolean {
    if (!(other instanceof MultiSelection)) return false;
    const mine = this.spans;
    const theirs = other.spans;
    return (
      mine.length === theirs.length &&
      mine.every(([a, b], index) => theirs[index][0] === a && theirs[index][1] === b)
    );
  }

  toJSON(): { type: string; spans: Span[]; anchor: number; head: number } {
    return { type: "multi", spans: this.spans, anchor: this.anchor, head: this.head };
  }

  static fromJSON(
    doc: ProseMirrorNode,
    json: { spans: Span[]; anchor: number; head: number }
  ): Selection {
    return MultiSelection.create(doc, json.spans, json.anchor, json.head);
  }
}

Selection.jsonID("multi", MultiSelection);

export type Held = { readonly held: readonly Span[] | null };

export const MULTI = new PluginKey<Held>("document-editor.multi-selection");

const NONE: Held = { held: null };

export const heldSpans = (selection: Selection): Span[] =>
  selection instanceof MultiSelection
    ? selection.spans
    : selection.empty
      ? []
      : [[selection.from, selection.to]];

export const combined = (state: EditorState): Selection | undefined => {
  const held = MULTI.getState(state)?.held;
  if (held === null || held === undefined) return undefined;

  const current = state.selection;
  if (current instanceof MultiSelection || current.empty) return undefined;
  if (!(current instanceof TextSelection)) return undefined;

  return MultiSelection.create(
    state.doc,
    [...held, [current.from, current.to]],
    current.anchor,
    current.head
  );
};

export const multiSelection = (): Plugin<Held> =>
  new Plugin<Held>({
    key: MULTI,
    state: {
      init: () => NONE,
      apply: (transaction, value) => {
        const next = transaction.getMeta(MULTI) as Held | undefined;
        if (next !== undefined) return next;
        if (value.held === null || !transaction.docChanged) return value;

        return {
          held: value.held.map(
            ([from, to]) => [transaction.mapping.map(from), transaction.mapping.map(to)] as Span
          )
        };
      }
    },
    appendTransaction: (transactions, _old, state) => {
      if (!transactions.some((transaction) => transaction.selectionSet)) return null;
      const next = combined(state);
      if (next === undefined) return null;

      return state.tr.setSelection(next).setMeta("addToHistory", false);
    },
    props: {
      handleDOMEvents: {
        mousedown: (view, event) => {
          const adding = event.metaKey || event.ctrlKey;
          const held = adding ? heldSpans(view.state.selection) : null;
          const current = MULTI.getState(view.state)?.held ?? null;
          if ((held === null && current === null) || (held !== null && held.length === 0)) {
            if (current !== null) {
              view.dispatch(view.state.tr.setMeta(MULTI, NONE).setMeta("addToHistory", false));
            }
            return false;
          }

          view.dispatch(view.state.tr.setMeta(MULTI, { held }).setMeta("addToHistory", false));
          return false;
        },
        mouseup: (view) => {
          if (MULTI.getState(view.state)?.held === null) return false;
          window.setTimeout(() => {
            if (MULTI.getState(view.state)?.held === null) return;
            view.dispatch(view.state.tr.setMeta(MULTI, NONE).setMeta("addToHistory", false));
          }, 0);
          return false;
        }
      },
      decorations: (state) => {
        const selection = state.selection;
        if (!(selection instanceof MultiSelection)) return DecorationSet.empty;

        return DecorationSet.create(
          state.doc,
          selection.spans
            .slice(1)
            .map(([from, to]) => Decoration.inline(from, to, { class: "multi-range" }))
        );
      }
    }
  });

export const secondarySpans = (selection: Selection): Span[] =>
  selection instanceof MultiSelection ? selection.spans.slice(1) : [];

export const isMulti = (selection: Selection): selection is MultiSelection =>
  selection instanceof MultiSelection;

export const withoutHeld = (transaction: Transaction): Transaction =>
  transaction.setMeta(MULTI, NONE);
