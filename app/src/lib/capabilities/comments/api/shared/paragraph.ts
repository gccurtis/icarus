import type { TextBlock } from "$representation/data/types/content/content-block";

const fresh = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const paragraphOf = (text: string): TextBlock => ({
  id: fresh("block"),
  type: "text",
  variant: "paragraph",
  atoms: [{ id: fresh("atom"), kind: "literal", text }],
  display: text,
  marks: []
});
