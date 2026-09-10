import type { ActivityTarget } from "$representation/data/types/collaboration/activity";
import type { AnchorWithin, Resolution } from "$representation/data/types/collaboration/anchor";
import type { CommentTarget } from "$representation/data/types/collaboration/comment";
import type { ContentBlock, MarkLink } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";

export type CommentThreadFields = {
  projectId: Id<"projects">;
  target: CommentTarget;
  within?: AnchorWithin;
  quote?: string;
  resolution?: Resolution;
  createdBy: Actor;
  updatedAt: number;
};
export type CommentThread = Row<"commentThreads"> & CommentThreadFields;

export type CommentFields = {
  projectId: Id<"projects">;
  threadId: Id<"commentThreads">;
  blocks: ContentBlock[];
  mentions: MarkLink[];
  author: Actor;
  editedAt?: number;
};
export type Comment = Row<"comments"> & CommentFields;

export type ActivityFields = {
  projectId: Id<"projects">;
  actor: Actor;
  actorLabel: string;
  verb: string;
  target: ActivityTarget;
  context?: ActivityTarget;
  detail?: string;
};
export type Activity = Row<"activity"> & ActivityFields;
