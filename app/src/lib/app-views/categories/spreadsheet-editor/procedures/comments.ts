import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { CommentThread } from "$representation/store/tables";
import type { SurfacePin } from "$authored-components/sheet-surface";
import {
  indexOf,
  keyOf,
  labelOf,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  remarkBlock,
  type Remark
} from "$app-views/categories/spreadsheet-editor/procedures/comment-copy";
import { createRow } from "$app-views/categories/spreadsheet-editor/procedures/creating-row";
import { refreshAll } from "$app-views/categories/spreadsheet-editor/procedures/refreshing-queries";
import type { TableQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";

export type Thread = CommentThread;

const onSheet = (thread: Thread, sheetId: string): boolean =>
  thread.target.kind === "spreadsheet" && thread.target.id === sheetId;

export const threadsOf = (rows: readonly Thread[], sheetId: string): Thread[] =>
  rows
    .filter((thread) => onSheet(thread, sheetId) && thread.resolution === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);

export const resolvedOf = (rows: readonly Thread[], sheetId: string): Thread[] =>
  rows
    .filter((thread) => onSheet(thread, sheetId) && thread.resolution !== undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);

export const remarksOf = (rows: readonly Remark[], threadId: string): Remark[] =>
  rows.filter((remark) => remark.threadId === threadId).sort((a, b) => a._creationTime - b._creationTime);

export type NewComment = {
  readonly projectId: string;
  readonly sheetId: string;
  readonly ref: CellRef;
  readonly quote: string;
  readonly viewerId: string;
  readonly text: string;
  readonly queries: readonly TableQuery[];
  readonly sent: () => void;
};

/**
 * A first remark on a cell, which is a thread and a remark inside it.
 *
 * The thread carries what the cell showed when the question was asked. A reader
 * coming back to it later reads what was being talked about rather than what the
 * cell has since become.
 */
export const addsAComment = async (asked: NewComment): Promise<void> => {
  const author = { kind: "user" as const, userId: asked.viewerId };
  const made = await createRow("commentThreads", {
    projectId: asked.projectId,
    target: { kind: "spreadsheet", id: asked.sheetId },
    within: { kind: "cell", rowId: asked.ref.rowId, columnId: asked.ref.columnId },
    quote: asked.quote,
    createdBy: author,
    updatedAt: Date.now()
  });

  await createRow("comments", {
    projectId: asked.projectId,
    threadId: made.id,
    blocks: [remarkBlock(asked.text)],
    mentions: [],
    author
  });

  asked.sent();
  await refreshAll(...asked.queries);
};

export const anchorOf = (thread: Thread): CellRef | undefined =>
  thread.within?.kind === "cell" ? { rowId: thread.within.rowId, columnId: thread.within.columnId } : undefined;

export const anchorLabel = (grid: Grid, thread: Thread): string => {
  const ref = anchorOf(thread);
  if (ref === undefined) return "Sheet";
  return indexOf(grid, ref) === undefined ? "a cell that is gone" : labelOf(grid, ref);
};

export const threadsOnCell = (threads: readonly Thread[], ref: CellRef): Thread[] =>
  threads.filter((thread) => {
    const anchor = anchorOf(thread);
    return anchor !== undefined && anchor.rowId === ref.rowId && anchor.columnId === ref.columnId;
  });

export const pinsOf = (
  threads: readonly Thread[],
  sheet: LiveSheet,
  grid: Grid,
  current: string | undefined,
  at?: string
): Map<string, SurfacePin> => {
  const pins = new Map<string, SurfacePin>();
  void sheet;
  for (const thread of threads) {
    const ref = anchorOf(thread);
    if (ref === undefined || indexOf(grid, ref) === undefined) continue;
    const key = keyOf(ref);
    const held = pins.get(key);
    const chosen = thread._id === current || key === at;
    const state = chosen || held?.state === "current" ? "current" : "open";
    pins.set(key, { count: (held?.count ?? 0) + 1, state });
  }
  return pins;
};
