import {
  readComments,
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
export const threadOf = (
  rows: readonly CommentThread[],
  id: string
): CommentThread | undefined => rows.find((thread) => thread._id === id);

export const remarksOf = (
  rows: readonly Comment[],
  threadId: string
): Comment[] =>
  rows
    .filter((remark) => remark.threadId === threadId)
    .sort((a, b) => a._creationTime - b._creationTime);
