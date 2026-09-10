import {
  type CommentActor,
  type ReadCommentsResult
} from "$capabilities/comments/index.remote";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import { since } from "$app-views/categories/project-overview/procedures/rows";

export type Mention = {
  /** The discussion lifetime; the comment inspector is keyed by its thread. */
  readonly id: string;
  readonly age: string;
  readonly author: CommentActor;
  readonly resource: string;
  readonly location?: string;
  readonly excerpt: string;
};

/** A comment names you when one of its mention marks points at you. */
/**
 * Comments addressed to you, newest first.
 *
 * The thread is what says where the remark landed, so a comment whose thread has
 * not loaded is dropped: a mention that cannot say what it is about is worse
 * than one fewer row in a band that is already the shortest on the board.
 */
export const mentions = (
  viewer: string,
  now: number,
  feed: ReadCommentsResult | undefined,
  resourceIndex: ProjectResourceIndex | undefined
): readonly Mention[] => {
  const resources = resourceIndex?.resources ?? [];
  return (feed?.remarks ?? [])
    .filter((comment) => comment.mentionedUserIds.includes(viewer))
    .slice()
    .sort((a, b) => b._creationTime - a._creationTime)
    .flatMap((comment) => {
      const thread = feed?.threads.find((candidate) => candidate._id === comment.threadId);
      if (thread === undefined) return [];

      return [
        {
          id: thread._id,
          age: since(comment._creationTime, now),
          author: comment.author,
          resource: resources.find((resource) => resource.id === thread.target.id)?.name ?? thread.target.id,
          location: thread.quote,
          excerpt: comment.text
        }
      ];
    });
};
