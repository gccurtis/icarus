import { startThread } from "$capabilities/comments/index.remote";
import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";

export type DocumentCommentInput = {
  readonly documentId: string;
  readonly within: AnchorWithin;
  readonly quote?: string;
  readonly text: string;
};

export const startDocumentComment = (input: DocumentCommentInput) => startThread({
  target: { kind: "document", id: input.documentId },
  within: input.within,
  ...(input.quote === undefined ? {} : { quote: input.quote }),
  text: input.text
});
