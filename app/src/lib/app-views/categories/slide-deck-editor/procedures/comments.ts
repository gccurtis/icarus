import type { Actor } from "$representation/data/types/core/actor";
import type {
  Comment,
  CommentThread,
  TableName,
  TableRow,
  User
} from "$representation/store/tables";
import { readStore } from "$model/client/workspace-state";

export type { CommentThread } from "$representation/store/tables";

export type TableQuery = ReturnType<typeof readStore>;

export const tableQuery = (table: TableName): TableQuery => readStore(table);

export const rowsOf = <T extends TableName>(
  query: TableQuery,
  table: T
): readonly TableRow<T>[] => {
  if (!query.ready) return [];

  const found = query.current;
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

export const remarksOf = (
  rows: readonly Comment[],
  threadId: string
): Comment[] =>
  rows
    .filter((remark) => remark.threadId === threadId)
    .sort((a, b) => a._creationTime - b._creationTime);

export const nameOf = (users: readonly User[], actor: Actor | undefined): string => {
  if (actor === undefined) return "Someone";
  if (actor.kind !== "user") return "An agent";

  return users.find((user) => user._id === actor.userId)?.displayName ?? "Someone";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ago = (at: number, now: number): string => {
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

export const textOf = (remark: Comment): string =>
  remark.blocks
    .map((block) => ("display" in block ? block.display : ""))
    .filter((text) => text.length > 0)
    .join("\n");

export const belongsToDeck = (
  thread: CommentThread,
  deckId: string | undefined
): boolean => thread.target.kind === "slides" && thread.target.id === deckId;
