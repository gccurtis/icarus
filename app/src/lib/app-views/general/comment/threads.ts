import type { Actor } from "$representation/data/types/core/actor";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Comment, CommentThread, TableName, TableRow, User } from "$representation/store/tables";
import { textAnchorSpans } from "$representation/data/behavior/collaboration/anchors";
import { readStore, readUsername } from "$model/client/workspace-state";

export type { Comment, CommentThread, User } from "$representation/store/tables";

export type TableQuery = ReturnType<typeof readStore>;

export const tableQuery = (table: TableName): TableQuery => readStore(table);

export const rowsOf = <T extends TableName>(query: TableQuery, table: T): readonly TableRow<T>[] => {
  if (!query.ready) return [];

  const found = query.current;
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

export const rowsIn = <T extends TableName>(table: T): readonly TableRow<T>[] =>
  rowsOf(readStore(table), table);

export const refreshAll = (...queries: readonly TableQuery[]): Promise<void> =>
  Promise.all(queries.map((query) => query.refresh())).then(() => undefined);

export const viewerId = (): string => {
  const answer = readUsername();
  if (!answer.ready) return "";

  const name = answer.current;
  return rowsIn("users").find((user) => user.displayName === name)?._id ?? "";
};

export const threadOf = (rows: readonly CommentThread[], id: string): CommentThread | undefined =>
  rows.find((thread) => thread._id === id);

export const remarksOf = (rows: readonly Comment[], threadId: string): Comment[] =>
  rows
    .filter((remark) => remark.threadId === threadId)
    .sort((a, b) => a._creationTime - b._creationTime);

export const nameOf = (users: readonly User[], actor: Actor | undefined): string => {
  if (actor === undefined) return "Someone";
  if (actor.kind !== "user") return "An agent";

  return users.find((user) => user._id === actor.userId)?.displayName ?? "Someone";
};

export const userIdOf = (actor: Actor | undefined): string | undefined =>
  actor?.kind === "user" ? actor.userId : undefined;

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

let counter = 0;

const mint = (kind: string): string => {
  counter += 1;
  return `#${kind}-${Date.now().toString(36)}-${counter.toString(36)}`;
};

export const remarkBlock = (text: string): TextBlock => ({
  id: mint("block"),
  type: "text",
  variant: "paragraph",
  atoms: [{ id: mint("atom"), kind: "literal", text }],
  display: text,
  marks: []
});

export const replyFields = (
  thread: CommentThread,
  text: string,
  by: string
): Omit<Comment, "_id" | "_creationTime"> => ({
  projectId: thread.projectId,
  threadId: thread._id,
  blocks: [remarkBlock(text)],
  mentions: [],
  author: { kind: "user", userId: by as User["_id"] }
});

export const blockIdOf = (thread: CommentThread): string | undefined =>
  textAnchorSpans(thread.within)[0]?.blockId;
