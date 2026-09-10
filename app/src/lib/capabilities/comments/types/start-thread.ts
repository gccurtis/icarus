import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
import type { CommentTarget } from "$representation/data/types/collaboration/comment";

export type StartThreadInput = {
  readonly target: CommentTarget;
  readonly within?: AnchorWithin;
  readonly quote?: string;
  readonly text: string;
};

export type StartThreadResult = {
  readonly threadId: string;
  readonly commentId: string;
};
