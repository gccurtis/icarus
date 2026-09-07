import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { Comment, CommentThread, User } from "$representation/store/tables";
import type { SurfacePin } from "$authored-components/sheet-surface";
import {
  indexOf,
  keyOf,
  labelOf,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";

export type Thread = CommentThread;
export type Remark = Comment;
export type Person = User;

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
