import {
  readComments,
  type CommentPersonRecord,
  type CommentRemarkRecord,
  type CommentThreadRecord
} from "$capabilities/comments/index.remote";

export type Thread = CommentThreadRecord;
export type Remark = CommentRemarkRecord;
export type Person = CommentPersonRecord;
export type CommentsQuery = ReturnType<typeof readComments>;

export const commentsQuery = (): CommentsQuery => readComments();
export const threadsIn = (query: CommentsQuery): readonly Thread[] => query.current?.threads ?? [];
export const remarksIn = (query: CommentsQuery): readonly Remark[] => query.current?.remarks ?? [];
export const peopleIn = (query: CommentsQuery): readonly Person[] => query.current?.people ?? [];
export const viewerId = (query: CommentsQuery): string => query.current?.viewerId ?? "";

export const threadOf = (rows: readonly Thread[], id: string): Thread | undefined =>
  rows.find((thread) => thread._id === id);

export const threadsOf = (rows: readonly Thread[], documentId: string): Thread[] =>
  rows
    .filter(
      (thread) =>
        thread.target.kind === "document" &&
        thread.target.id === documentId &&
        thread.resolution === undefined
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);

export const remarksOf = (rows: readonly Remark[], threadId: string): Remark[] =>
  rows
    .filter((remark) => remark.threadId === threadId)
    .sort((left, right) => left._creationTime - right._creationTime);
