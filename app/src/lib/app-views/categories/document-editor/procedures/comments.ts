import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
import { textAnchorSpans } from "$representation/data/behavior/collaboration/anchors";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { Selection } from "$representation/data/types/workspace/tab";
import type { Comment, CommentThread, User } from "$representation/store/tables";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
import { blockOf, rangesOf, type Range } from "$app-views/categories/document-editor/procedures/marks";
import { endAt, linearOf } from "$app-views/categories/document-editor/procedures/projection";

export type Thread = CommentThread;
export type Remark = Comment;
export type Person = User;

export type { AnchorWithin } from "$representation/data/types/collaboration/anchor";

export const firstAnchorBlockId = (thread: Thread): string | undefined =>
  textAnchorSpans(thread.within)[0]?.blockId;

export const threadsOf = (rows: readonly Thread[], documentId: string): Thread[] =>
  rows
    .filter(
      (thread) =>
        thread.target.kind === "document" &&
        thread.target.id === documentId &&
        thread.resolution === undefined
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

export const remarksOf = (rows: readonly Remark[], threadId: string): Remark[] =>
  rows
    .filter((remark) => remark.threadId === threadId)
    .sort((a, b) => a._creationTime - b._creationTime);

export const nameOf = (users: readonly Person[], actor: Actor | undefined): string => {
  if (actor === undefined) return "Someone";
  if (actor.kind !== "user") return "An agent";

  return users.find((user) => user._id === actor.userId)?.displayName ?? "Someone";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ago = (at: number, now: number = Date.now()): string => {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return DAYS[new Date(at).getDay()];

  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const textOf = (remark: Remark): string =>
  remark.blocks
    .map((block) => ("display" in block ? block.display : ""))
    .filter((text) => text.length > 0)
    .join("\n");

export const remarkBlock = (text: string): TextBlock => ({
  id: mint("block"),
  type: "text",
  variant: "paragraph",
  atoms: [{ id: mint("atom"), kind: "literal", text }],
  display: text,
  marks: []
});

export const anchorOf = (body: DocumentBody, selection: Selection): AnchorWithin | undefined => {
  const spans = rangesOf(body, selection).flatMap((range) => {
    const block = blockOf(body, range.blockId);
    if (block === undefined) return [];
    return [{
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
  if (anchor === undefined || anchor.kind !== "text") return undefined;

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

export const threadsOn = (
  threads: readonly Thread[],
  body: DocumentBody,
  selection: Selection | undefined
): Thread[] => {
  if (selection === undefined) return [];

  const anchored = anchoredOf(threads, body);
  const ranges = rangesOf(body, selection);

  if (ranges.length > 0) {
    return anchored.filter((held) => ranges.some((range) => overlaps(held, range))).map((held) => held.thread);
  }

  const caret = addressOf(selection.id);
  if (caret === undefined) return [];
  const block = blockOf(body, caret.blockId);
  if (block === undefined) return [];
  const at = linearOf(block.atoms, { atom: caret.atomId, offset: caret.offset });

  return anchored.filter((held) => touches(held, caret.blockId, at)).map((held) => held.thread);
};

export const detached = (thread: Thread, body: DocumentBody): boolean => {
  const within = thread.within;
  if (within === undefined) return false;
  if (within.kind !== "text") return true;
  const spans = textAnchorSpans(within);
  return spans.length === 0 || spans.some((span) => blockOf(body, span.blockId) === undefined);
};

export const threadFields = (held: {
  readonly projectId: string;
  readonly documentId: string;
  readonly within: AnchorWithin | undefined;
  readonly quote: string | undefined;
  readonly by: string;
  readonly now: number;
}): Omit<Thread, "_id" | "_creationTime"> => ({
  projectId: held.projectId as Thread["projectId"],
  target: { kind: "document", id: held.documentId },
  ...(held.within === undefined ? {} : { within: held.within }),
  ...(held.quote === undefined || held.quote.length === 0 ? {} : { quote: held.quote }),
  createdBy: { kind: "user", userId: held.by as Person["_id"] },
  updatedAt: held.now
});

export const remarkFields = (held: {
  readonly projectId: string;
  readonly threadId: string;
  readonly text: string;
  readonly by: string;
}): Omit<Remark, "_id" | "_creationTime"> => ({
  projectId: held.projectId as Remark["projectId"],
  threadId: held.threadId as Remark["threadId"],
  blocks: [remarkBlock(held.text)],
  mentions: [],
  author: { kind: "user", userId: held.by as Person["_id"] }
});
