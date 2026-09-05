export type IdKind = "row" | "block" | "atom" | "mark";

const LETTER: Record<IdKind, string> = { row: "r", block: "b", atom: "a", mark: "m" };

export const mint = (kind: IdKind): string =>
  `#${LETTER[kind]}${Math.random().toString(36).slice(2, 8)}`;
