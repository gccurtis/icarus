import type { PromptBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { linearOf } from "$app-views/categories/document-editor/procedures/projection";

export type { PromptBlock, PromptState } from "$representation/data/types/content/content-block";
export type { Id } from "$representation/data/types/core/id";
export type LinkedPromptBlock = PromptBlock & { derivedOutputId: Id<"derivedOutputs"> };

/** Prompt Blocks are body content. Furniture is deliberately not a generation surface. */
export const promptBlocksIn = (body: DocumentBody | undefined): readonly PromptBlock[] =>
  body?.rows.flatMap((row) =>
    row.kind === "blocks"
      ? row.blocks.filter((block): block is PromptBlock => block.type === "prompt")
      : []
  ) ?? [];

const setField = (
  block: PromptBlock,
  field: string,
  value: unknown,
  was: unknown
): DocumentOp | undefined =>
  JSON.stringify(value ?? null) === JSON.stringify(was ?? null)
    ? undefined
    : { op: "set", target: "block", path: `${block.id}/${field}`, value: value ?? null, was: was ?? null };

export const linkPromptBlockOps = (
  block: PromptBlock,
  derivedOutputId: Id<"derivedOutputs">
): DocumentOp[] => {
  const op = setField(block, "derivedOutputId", derivedOutputId, block.derivedOutputId);
  return op === undefined ? [] : [op];
};

const responseOf = (output: DerivedOutput): string | undefined =>
  output.lastResponse?.type === "text" ? output.lastResponse.display : undefined;

/** Keep author formatting while replacing the generated text underneath it. */
const presentationOf = (
  block: PromptBlock,
  text: string
): Pick<PromptBlock, "atoms" | "display" | "marks"> => {
  const atomId = block.atoms.find((atom) => atom.kind === "literal")?.id ?? mint("atom");
  const oldLength = block.display.length;
  const nextLength = text.length;
  const marks = block.marks.flatMap((mark) => {
    const from = linearOf(block.atoms, mark.from);
    const to = linearOf(block.atoms, mark.to);
    const nextFrom = from === oldLength ? nextLength : Math.min(from, nextLength);
    const nextTo = to === oldLength ? nextLength : Math.min(to, nextLength);
    return nextFrom >= nextTo
      ? []
      : [{ ...mark, from: { atom: atomId, offset: nextFrom }, to: { atom: atomId, offset: nextTo } }];
  });

  return {
    atoms: [{ id: atomId, kind: "literal", text }],
    display: text,
    marks
  };
};

/** Copy a published value into the editable Prompt Block as one ordinary document edit. */
export const syncPromptBlockOps = (
  block: PromptBlock,
  output: DerivedOutput
): DocumentOp[] => {
  const response = responseOf(output);
  const presentation = response === undefined ? undefined : presentationOf(block, response);
  const candidates = [
    ...(presentation === undefined
      ? []
      : [
          setField(block, "atoms", presentation.atoms, block.atoms),
          setField(block, "display", presentation.display, block.display),
          setField(block, "marks", presentation.marks, block.marks)
        ]),
    setField(block, "state", output.state, block.state),
    setField(block, "error", output.error, block.error),
    setField(block, "refreshedAt", output.refreshedAt, block.refreshedAt)
  ];

  return candidates.filter((op): op is DocumentOp => op !== undefined);
};
