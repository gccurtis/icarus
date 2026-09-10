import {
  readComments,
  type CommentPersonRecord,
  type CommentRemarkRecord,
  type CommentThreadRecord
} from "$capabilities/comments/index.remote";

export type CommentsQuery = ReturnType<typeof readComments>;

export const commentsQuery = (): CommentsQuery => readComments();
export const threadsIn = (query: CommentsQuery): readonly CommentThreadRecord[] =>
  query.current?.threads ?? [];
export const remarksIn = (query: CommentsQuery): readonly CommentRemarkRecord[] =>
  query.current?.remarks ?? [];
export const peopleIn = (query: CommentsQuery): readonly CommentPersonRecord[] =>
  query.current?.people ?? [];
export const viewerId = (query: CommentsQuery): string => query.current?.viewerId ?? "";
