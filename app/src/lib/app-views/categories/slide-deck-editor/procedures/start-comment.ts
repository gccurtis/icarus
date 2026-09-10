import { startThread } from "$capabilities/comments/index.remote";
import type { CommentAnchor } from "$capabilities/comments/index.remote";

export type SlideCommentInput = {
  readonly deckId: string;
  readonly within?: Extract<CommentAnchor, { kind: "slide" | "element" }>;
  readonly text: string;
};

export const startSlideComment = (input: SlideCommentInput) => startThread({
  target: { kind: "slides", id: input.deckId },
  ...(input.within === undefined ? {} : { within: input.within }),
  text: input.text
});
