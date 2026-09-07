import { mint } from "$app-views/categories/document-editor/procedures/ids";
import type { PromptBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";

export type PromptBlockInsertion = {
  readonly block: PromptBlock;
  readonly row: Extract<DocumentRow, { kind: "blocks" }>;
  readonly op: Extract<DocumentOp, { op: "insert" }>;
};

/** Prompt Blocks are body content. Furniture is deliberately not a generation surface. */
export const promptBlocksIn = (body: DocumentBody | undefined): readonly PromptBlock[] =>
  body?.rows.flatMap((row) =>
    row.kind === "blocks"
      ? row.blocks.filter((block): block is PromptBlock => block.type === "prompt")
      : []
  ) ?? [];

/**
 * Translate one placement decision into the document's native edit vocabulary.
 * The generated value does not live here: this block persists only its identity
 * and the Derived Output foreign key.
 */
export const appendPromptBlock = (
  body: DocumentBody,
  derivedOutputId: Id<"derivedOutputs">
): PromptBlockInsertion => {
  const block: PromptBlock = {
    id: mint("block"),
    type: "prompt",
    derivedOutputId,
    atoms: [],
    display: "",
    marks: [],
    state: "idle"
  };
  const row: Extract<DocumentRow, { kind: "blocks" }> = {
    id: mint("row"),
    kind: "blocks",
    blocks: [block]
  };
  const after = body.rows.at(-1)?.id ?? null;

  return {
    block,
    row,
    op: {
      op: "insert",
      target: "row",
      path: "rows",
      ids: [row.id],
      after,
      values: [row]
    }
  };
};
