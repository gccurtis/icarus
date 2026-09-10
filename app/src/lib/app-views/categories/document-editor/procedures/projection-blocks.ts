import type {
  ContentBlock,
  TextAtom
} from "$representation/data/types/content/content-block";
import type { DocumentRow } from "$representation/data/types/documents/body";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import type { Styled } from "$app-views/categories/document-editor/procedures/styles";

export const isStyled = (block: ContentBlock): block is Styled =>
  block.type === "text" || block.type === "prompt";

export const soleLiteral = (block: ContentBlock): TextAtom | undefined => {
  if (block.type !== "text") return undefined;

  const [only, ...rest] = block.atoms;
  return rest.length === 0 && only?.kind === "literal" ? only : undefined;
};

export const emptyRow = (): DocumentRow => ({
  id: mint("row"),
  kind: "blocks",
  blocks: [
    {
      id: mint("block"),
      type: "text",
      variant: "paragraph",
      atoms: [{ id: mint("atom"), kind: "literal", text: "" }],
      display: "",
      marks: []
    }
  ]
});
