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
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import { wordAt } from "$app-views/categories/document-editor/procedures/links";

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
  if (!current.$from.parent.inlineContent || !current.$to.parent.inlineContent) return undefined;

  return MultiSelection.create(
    state.doc,
    [...held, [current.from, current.to]],
    current.anchor,
    current.head
  );
};

const wordSpanAt = (view: EditorView, event: MouseEvent): Span | undefined => {
  if (!(event.target instanceof Element)) return undefined;
  const blockId = event.target.closest<HTMLElement>("[data-block]")?.dataset.block;
  if (blockId === undefined) return undefined;

  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (hit === null) return undefined;

  let span: Span | undefined;
  view.state.doc.descendants((node, before) => {
    if (span !== undefined) return false;
    if (node.type.name !== "text_block" || node.attrs.blockId !== blockId) return;

    const word = wordAt(node.textContent, hit.pos - before - 1);
    if (word === undefined) return false;
    span = [before + 1 + word.from, before + 1 + word.to];
    return false;
  });

  return span;
};

export const multiSelection = (): Plugin<Held> => {
  let cleanup: ReturnType<typeof setTimeout> | undefined;
  let drag:
    | {
        readonly held: readonly Span[];
        readonly start: number;
        readonly x: number;
        readonly y: number;
      }
    | undefined;

  const cancelCleanup = () => {
    if (cleanup !== undefined) clearTimeout(cleanup);
    cleanup = undefined;
  };

  const clearHeld = (view: EditorView) => {
    cancelCleanup();
    drag = undefined;
    if (MULTI.getState(view.state)?.held === null) return;
    view.dispatch(view.state.tr.setMeta(MULTI, NONE).setMeta("addToHistory", false));
  };

  const pointerSelection = (
    view: EditorView,
    pointer: NonNullable<typeof drag>,
    x: number,
    y: number
  ): Selection | undefined => {
    const end = view.posAtCoords({ left: x, top: y });
    if (end === null) return undefined;

    const added = TextSelection.between(
      view.state.doc.resolve(pointer.start),
      view.state.doc.resolve(end.pos)
    );
    if (added.empty) return undefined;

    return MultiSelection.create(
      view.state.doc,
      [...pointer.held, [added.from, added.to]],
      added.anchor,
      added.head
    );
  };

  return new Plugin<Held>({
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
          const current = MULTI.getState(view.state)?.held ?? null;
          if (!adding) {
            drag = undefined;
            cancelCleanup();
            if (current !== null) {
              view.dispatch(view.state.tr.setMeta(MULTI, NONE).setMeta("addToHistory", false));
            }
            return false;
          }

          cancelCleanup();
          // The second press of a double-click must retain the selection that
          // existed before its first press; the intervening click is a caret.
          const held = event.detail > 1 && current !== null
            ? current
            : heldSpans(view.state.selection);
          if ((held === null && current === null) || (held !== null && held.length === 0)) {
            if (current !== null) {
              view.dispatch(view.state.tr.setMeta(MULTI, NONE).setMeta("addToHistory", false));
            }
            return false;
          }

          const start = view.posAtCoords({ left: event.clientX, top: event.clientY });
          drag = start === null
            ? undefined
            : { held, start: start.pos, x: event.clientX, y: event.clientY };
          view.dispatch(view.state.tr.setMeta(MULTI, { held }).setMeta("addToHistory", false));
          return false;
        },
        mousemove: (view, event) => {
          const pointer = drag;
          if (
            pointer === undefined ||
            (event.buttons & 1) === 0 ||
            (Math.abs(event.clientX - pointer.x) <= 4 && Math.abs(event.clientY - pointer.y) <= 4)
          ) {
            return false;
          }

          const selection = pointerSelection(view, pointer, event.clientX, event.clientY);
          if (selection === undefined) return false;

          // Once this is recognizably a drag, stop the browser from repainting
          // its own modifier-dependent DOM interval. Paint the independent
          // ProseMirror ranges at pointer cadence so Chromium does not wait
          // until mouseup and Firefox cannot reconnect them.
          event.preventDefault();
          if (!selection.eq(view.state.selection)) {
            view.dispatch(
              view.state.tr.setSelection(selection).setMeta("addToHistory", false)
            );
          }
          return true;
        },
        mouseup: (view, event) => {
          const pointer = drag;
          drag = undefined;
          if (MULTI.getState(view.state)?.held === null) return false;
          if (event.detail > 1) return false;

          // Browsers disagree about the anchor of a modified contenteditable
          // drag. Some extend from the old selection, which produces the exact
          // all-the-text-between result this plugin exists to avoid. Rebuild
          // the added range from this gesture's own pointer endpoints instead
          // of trusting the browser's interim DOM selection.
          if (
            pointer !== undefined &&
            (Math.abs(event.clientX - pointer.x) > 4 || Math.abs(event.clientY - pointer.y) > 4)
          ) {
            const selection = pointerSelection(view, pointer, event.clientX, event.clientY);
            if (selection !== undefined) {
              event.preventDefault();
              cancelCleanup();
              view.dispatch(
                view.state.tr
                  .setSelection(selection)
                  .setMeta(MULTI, NONE)
                  .setMeta("addToHistory", false)
              );
              view.focus();
              return true;
            }
          }

          // A drag has already produced the final MultiSelection. A first
          // click may still become a double-click, so retain its base briefly;
          // the explicit dblclick handler below owns final word selection.
          if (view.state.selection instanceof MultiSelection) clearHeld(view);
          else cleanup = setTimeout(() => clearHeld(view), 700);
          return false;
        },
        dblclick: (view, event) => {
          if (!event.metaKey && !event.ctrlKey) return false;
          drag = undefined;
          const held = MULTI.getState(view.state)?.held;
          if (held === null || held === undefined || held.length === 0) return false;
          const word = wordSpanAt(view, event);
          if (word === undefined) return false;

          event.preventDefault();
          event.stopPropagation();
          cancelCleanup();
          view.dispatch(
            view.state.tr
              .setSelection(MultiSelection.create(view.state.doc, [...held, word], word[0], word[1]))
              .setMeta(MULTI, NONE)
              .setMeta("addToHistory", false)
          );
          view.focus();
          return true;
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
    },
    view: () => ({ destroy: cancelCleanup })
  });
};

export const secondarySpans = (selection: Selection): Span[] =>
  selection instanceof MultiSelection ? selection.spans.slice(1) : [];

export const isMulti = (selection: Selection): selection is MultiSelection =>
  selection instanceof MultiSelection;

export const withoutHeld = (transaction: Transaction): Transaction =>
  transaction.setMeta(MULTI, NONE);
