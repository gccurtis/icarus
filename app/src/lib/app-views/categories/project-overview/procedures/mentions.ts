import { rowsIn, since } from "$app-views/categories/project-overview/procedures/rows";
import { nameOf } from "$app-views/categories/project-overview/procedures/resources";
import type { Actor } from "$representation/data/types/core/actor";

export type Mention = {
  readonly id: string;
  readonly age: string;
  readonly author: Actor;
  readonly resource: string;
  readonly location?: string;
  readonly excerpt: string;
};

/** A comment names you when one of its mention marks points at you. */
const names = (mentions: readonly { kind: string }[], viewer: string): boolean =>
  mentions.some(
    (mark) =>
      mark.kind === "actor" &&
      "actor" in mark &&
      (mark.actor as Actor).kind === "user" &&
      (mark.actor as { userId: string }).userId === viewer
  );

/**
 * Comments addressed to you, newest first.
 *
 * The thread is what says where the remark landed, so a comment whose thread has
 * not loaded is dropped: a mention that cannot say what it is about is worse
 * than one fewer row in a band that is already the shortest on the board.
 */
export const mentions = (
  projectId: string,
  viewer: string,
  now: number
): readonly Mention[] => {
  const threads = rowsIn("commentThreads");

  return rowsIn("comments")
    .filter((comment) => comment.projectId === projectId && names(comment.mentions, viewer))
    .slice()
    .sort((a, b) => b._creationTime - a._creationTime)
    .flatMap((comment) => {
      const thread = threads.find((candidate) => candidate._id === comment.threadId);
      if (thread === undefined) return [];

      const first = comment.blocks[0];
      return [
        {
          id: comment._id,
          age: since(comment._creationTime, now),
          author: comment.author,
          resource: nameOf(projectId, thread.target.id, now),
          location: thread.quote,
          excerpt: first !== undefined && first.type === "text" ? first.display : ""
        }
      ];
    });
};
