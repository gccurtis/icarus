import { textAnchorSpans } from "$representation/data/behavior/collaboration/anchors";
import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { Selection } from "$representation/data/types/workspace/tab";
import type { Thread } from "$app-views/categories/document-editor/procedures/comments";
import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
import { blockOf, rangesOf, type Range } from "$app-views/categories/document-editor/procedures/marks";
import { endAt, linearOf } from "$app-views/categories/document-editor/procedures/projection-atoms";

export type { AnchorWithin } from "$representation/data/types/collaboration/anchor";

export const firstAnchorBlockId = (thread: Thread): string | undefined =>
  textAnchorSpans(thread.within)[0]?.blockId;

export const blockIdOf = firstAnchorBlockId;

export const isCommentableSelection = (
  selection: Selection | undefined
): selection is Selection & { readonly kind: "text-selection"; readonly at: string } =>
  selection?.kind === "text-selection" &&
  selection.at !== undefined &&
  (selection.ranges?.length ?? 0) === 0;

export const anchorOf = (body: DocumentBody, selection: Selection): AnchorWithin | undefined => {
  const spans = rangesOf(body, selection).flatMap((range) => {
    const block = blockOf(body, range.blockId);
    return block === undefined
      ? []
      : [{
          blockId: range.blockId,
          from: endAt(block.atoms, range.from, "from"),
          to: endAt(block.atoms, range.to, "to")
        }];
  });
  return spans.length === 0 ? undefined : { kind: "text", spans };
};

export type Anchored = {
  readonly thread: Thread;
  readonly blockId: string;
  readonly from: number;
  readonly to: number;
};

export const anchoredOf = (threads: readonly Thread[], body: DocumentBody): Anchored[] => {
  const held: Anchored[] = [];
  for (const thread of threads) {
    for (const span of textAnchorSpans(thread.within)) {
      const block = blockOf(body, span.blockId);
      if (block === undefined) continue;
      const from = linearOf(block.atoms, span.from);
      const to = linearOf(block.atoms, span.to);
      held.push({ thread, blockId: span.blockId, from: Math.min(from, to), to: Math.max(from, to) });
    }
  }
  return held;
};

export const quoteOf = (body: DocumentBody, anchor: AnchorWithin | undefined): string | undefined => {
  if (anchor?.kind !== "text") return undefined;
  const quote = textAnchorSpans(anchor).flatMap((span) => {
    const block = blockOf(body, span.blockId);
    if (block === undefined) return [];
    const from = linearOf(block.atoms, span.from);
    const to = linearOf(block.atoms, span.to);
    return [block.display.slice(Math.min(from, to), Math.max(from, to))];
  }).join("\n");
  return quote.length === 0 ? undefined : quote;
};

const overlaps = (anchored: Anchored, range: Range): boolean =>
  anchored.blockId === range.blockId && anchored.from < range.to && anchored.to > range.from;

const touches = (anchored: Anchored, blockId: string, at: number): boolean =>
  anchored.blockId === blockId && anchored.from <= at && anchored.to >= at;

const distinctThreads = (anchored: readonly Anchored[]): Thread[] => {
  const seen = new Set<string>();
  return anchored.flatMap(({ thread }) => {
    if (seen.has(thread._id)) return [];
    seen.add(thread._id);
    return [thread];
  });
};

export const threadsOn = (
  threads: readonly Thread[],
  body: DocumentBody,
  selection: Selection | undefined
): Thread[] => {
  if (selection === undefined) return [];
  const anchored = anchoredOf(threads, body);
  const ranges = rangesOf(body, selection);
  if (ranges.length > 0) {
    return distinctThreads(anchored.filter((held) => ranges.some((range) => overlaps(held, range))));
  }
  const caret = addressOf(selection.id);
  if (caret === undefined) return [];
  const block = blockOf(body, caret.blockId);
  if (block === undefined) return [];
  const at = linearOf(block.atoms, { atom: caret.atomId, offset: caret.offset });
  return distinctThreads(anchored.filter((held) => touches(held, caret.blockId, at)));
};

export const detached = (thread: Thread, body: DocumentBody): boolean => {
  const within = thread.within;
  if (within === undefined) return false;
  if (within.kind !== "text") return true;
  const spans = textAnchorSpans(within);
  return spans.length === 0 || spans.some((span) => blockOf(body, span.blockId) === undefined);
};
