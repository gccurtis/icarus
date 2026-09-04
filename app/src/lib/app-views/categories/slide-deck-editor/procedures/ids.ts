export type IdKind = "slide" | "element" | "block" | "atom";

const PREFIX: Record<IdKind, string> = {
  slide: "slide",
  element: "el",
  block: "blk",
  atom: "atm"
};

/**
 * A fresh id for something inside a deck.
 *
 * Minted here rather than by the store because the id has to exist before the
 * round trip: a new slide is applied to the working body and selected the
 * moment it is asked for, and neither is possible against an id the client does
 * not yet know.
 *
 * The suffix is random rather than the next number up. Two clients editing one
 * deck mint against the same base revision, and a counter would hand both of
 * them the same id — which the flat id space cannot survive.
 */
export const mint = (kind: IdKind): string =>
  `${PREFIX[kind]}-${Math.random().toString(36).slice(2, 8)}`;
