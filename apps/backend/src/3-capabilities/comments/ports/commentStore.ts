import type {
  Comment,
  CommentActivityTransaction,
  CommentCommandReceipt,
  CommentPage,
  CommentState
} from "../domain/model.js";

export interface CommentListFilter {
  resourceKind: string;
  resourceId: string;
  state?: CommentState;
  cursor?: string;
  limit: number;
}

export interface CommentWriteCommit {
  comment: Comment;
  receipt: CommentCommandReceipt;
  activity: CommentActivityTransaction;
}

/** Durable project-local storage owned by Comments. */
export interface CommentStore {
  getComment(commentId: string): Promise<Comment | undefined>;
  listComments(filter: CommentListFilter): Promise<CommentPage>;
  getReceipt(requestId: string): Promise<CommentCommandReceipt | undefined>;

  commitCreation(commit: CommentWriteCommit): Promise<void>;
  commitMutation(commit: CommentWriteCommit): Promise<boolean>;
  recordReceipt(receipt: CommentCommandReceipt): Promise<void>;

  listUnpublishedActivity(limit?: number): Promise<CommentActivityTransaction[]>;
  markActivityPublished(transactionId: string, publishedAt: string): Promise<void>;
}
