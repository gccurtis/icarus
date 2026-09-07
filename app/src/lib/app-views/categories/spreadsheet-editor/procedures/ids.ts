export type IdKind = "row" | "column" | "rule" | "style" | "mark" | "block" | "atom";

const PREFIX: Record<IdKind, string> = {
  row: "r",
  column: "c",
  rule: "f",
  style: "style",
  mark: "m",
  block: "blk",
  atom: "atm"
};

export const mint = (kind: IdKind): string =>
  `${PREFIX[kind]}-${Math.random().toString(36).slice(2, 8)}`;
