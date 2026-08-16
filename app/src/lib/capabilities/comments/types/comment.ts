import type { CommentAnchor } from "$comments/types/anchor";
import { CommentsError } from "$comments/errors";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";
import type { Mention } from "$shared/types/mention";

/**
 * One remark, as a comment list renders it.
 *
 * `at` is the row's `_creationTime` — a comment stores no time of its own, because
 * the one thing it could say is when it was written and Convex already says that.
 */
export type Comment = {
  readonly id: Id<"comments">;
  readonly blocks: ContentBlock[];
  readonly author: Actor;
  readonly mentions?: Mention[];
  readonly editedAt?: number;
  readonly at: number;
};

/**
 * A thread and its replies.
 *
 * The comments come with it because a thread without them renders nothing — the
 * anchor and the resolved state are not what anybody reads. `projectId` stops at
 * the boundary: every thread returned is from the project that was asked about.
 */
export type Thread = {
  readonly id: Id<"commentThreads">;
  readonly anchor: CommentAnchor;
  readonly status: "open" | "resolved";
  /** A user, because closing a discussion is a judgement a person makes. */
  readonly resolvedBy?: Id<"users">;
  readonly resolvedAt?: number;
  readonly createdBy: Actor;
  readonly updatedAt: number;
  readonly comments: Comment[];
};

/** Whether a block puts anything on the screen. Text is the only kind that can be blank. */
const says = (block: ContentBlock): boolean =>
  block.type !== "text" || block.atoms.length > 0 || block.display.length > 0;

/**
 * The stored form of a remark: blocks, and at least one that says something.
 *
 * An empty comment is not a remark someone will come back to — it is an anchor
 * with nothing attached, which renders as a marker in a document that nobody can
 * act on and nobody can tell was a mistake.
 */
export const commentBody = (blocks: ContentBlock[]): ContentBlock[] => {
  if (!blocks.some(says)) {
    throw new CommentsError("empty-body", "A comment says something or it is not a comment");
  }
  return blocks;
};
