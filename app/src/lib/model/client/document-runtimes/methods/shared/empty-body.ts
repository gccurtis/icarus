import type { DocumentBody } from "$representation/data/types/documents/body";

const mint = (letter: string): string => `#${letter}${Math.random().toString(36).slice(2, 8)}`;

export const emptyBody = (): DocumentBody => ({
  rows: [
    {
      id: mint("r"),
      kind: "blocks",
      blocks: [
        {
          id: mint("b"),
          type: "text",
          variant: "paragraph",
          atoms: [{ id: mint("a"), kind: "literal", text: "" }],
          display: "",
          marks: []
        }
      ]
    }
  ]
});
