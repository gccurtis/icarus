import { api } from '$data/api';

/**
 * Anchored document comments (Omega `opts.Comments`). Threads pinned to a document
 * anchor (a block/atom range), with replies and a resolved state. Replaces the mock
 * comments that used to back the Comments panel.
 */

export interface CommentReply {
  id: string;
  commentId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  anchorId: string;
  authorId: string;
  authorName: string;
  body: string;
  resolved: boolean;
  /** True when the anchored text no longer exists (the block/range was removed). */
  anchorOrphaned: boolean;
  createdAt: string;
  updatedAt: string;
  replies: CommentReply[];
}

/** An inline anchor for a new comment — pins it to a block (optionally a range). */
export interface CommentAnchor {
  rowId?: string;
  blockId?: string;
  atomId?: string;
  start?: number;
  end?: number;
}

/** List a document's comments (optionally only resolved / only open). */
export async function loadComments(
  documentId: string,
  resolved?: boolean
): Promise<DocumentComment[]> {
  if (!documentId) return [];
  const query = resolved === undefined ? '' : `?resolved=${resolved}`;
  const res = await api<{ comments: DocumentComment[] }>(
    `/documents/${encodeURIComponent(documentId)}/comments${query}`
  );
  return res.comments ?? [];
}

/** Create a comment on a document, anchored to a block/range. */
export async function createComment(
  documentId: string,
  body: string,
  anchor: CommentAnchor
): Promise<DocumentComment> {
  return api<DocumentComment>(`/documents/${encodeURIComponent(documentId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, anchor })
  });
}

/** Reply to a comment thread. */
export async function replyToComment(commentId: string, body: string): Promise<CommentReply> {
  return api<CommentReply>(`/comments/${encodeURIComponent(commentId)}/replies`, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}

/** Patch a comment — resolve/reopen and/or edit its body. */
export async function patchComment(
  commentId: string,
  patch: { body?: string; resolved?: boolean }
): Promise<DocumentComment> {
  return api<DocumentComment>(`/comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
}

/** Delete a comment thread. */
export async function deleteComment(commentId: string): Promise<void> {
  await api(`/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
}
