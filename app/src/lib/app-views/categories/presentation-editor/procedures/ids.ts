export type IdKind = "slide" | "element" | "block" | "atom" | "mark" | "layout";

const PREFIX: Record<IdKind, string> = {
  slide: "slide",
  element: "el",
  block: "blk",
  atom: "atm",
  mark: "mrk",
  layout: "layout"
};

export const mint = (kind: IdKind): string =>
  `${PREFIX[kind]}-${Math.random().toString(36).slice(2, 8)}`;
