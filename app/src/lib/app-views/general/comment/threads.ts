import { textAnchorSpans } from "$representation/data/behavior/collaboration/anchors";
import {
  readComments,
  type CommentActor,
  type CommentPersonRecord,
  type CommentRemarkRecord,
  type CommentThreadRecord
} from "$capabilities/comments/index.remote";

export type Comment = CommentRemarkRecord;
export type CommentThread = CommentThreadRecord;
export type User = CommentPersonRecord;

export type CommentsQuery = ReturnType<typeof readComments>;
export const commentsQuery = (): CommentsQuery => readComments();
export const threadsIn = (query: CommentsQuery): readonly CommentThread[] => query.current?.threads ?? [];
export const remarksIn = (query: CommentsQuery): readonly Comment[] => query.current?.remarks ?? [];
export const peopleIn = (query: CommentsQuery): readonly User[] => query.current?.people ?? [];
export const viewerId = (query: CommentsQuery): string => query.current?.viewerId ?? "";
export const threadOf = (rows: readonly CommentThread[], id: string): CommentThread | undefined =>
  rows.find((thread) => thread._id === id);

export const remarksOf = (rows: readonly Comment[], threadId: string): Comment[] =>
  rows
    .filter((remark) => remark.threadId === threadId)
    .sort((a, b) => a._creationTime - b._creationTime);

export const nameOf = (users: readonly User[], actor: CommentActor | undefined): string => {
  if (actor === undefined) return "Someone";
  if (actor.kind !== "user") return "An agent";

  return users.find((user) => user._id === actor.userId)?.displayName ?? "Someone";
};

export const userIdOf = (actor: CommentActor | undefined): string | undefined =>
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

export const textOf = (remark: Comment): string => remark.text;

export const blockIdOf = (thread: CommentThread): string | undefined =>
  textAnchorSpans(thread.within)[0]?.blockId;
