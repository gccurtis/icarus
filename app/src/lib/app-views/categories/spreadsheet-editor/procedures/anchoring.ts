const TOKEN = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;

export type Anchored = { readonly text: string; readonly caret: number };

/** One written reference, and which half of it is being held still. */
export type Anchor = {
  readonly at: number;
  readonly end: number;
  readonly letters: string;
  readonly digits: string;
  readonly column: boolean;
  readonly row: boolean;
};

export const referenceAt = (text: string, caret: number): Anchor | undefined => {
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (caret < at || caret > end) continue;
    const [, column, letters, row, digits] = match;
    return { at, end, letters, digits, column: column === "$", row: row === "$" };
  }
  return undefined;
};

const written = (held: Anchor, column: boolean, row: boolean): string =>
  `${column ? "$" : ""}${held.letters}${row ? "$" : ""}${held.digits}`;

/** The label a reference would carry under one locking, for a control to show. */
export const anchorLabel = (held: Anchor, column: boolean, row: boolean): string =>
  written(held, column, row);

export const lockedAt = (
  text: string,
  caret: number,
  column: boolean,
  row: boolean
): Anchored | undefined => {
  const held = referenceAt(text, caret);
  if (held === undefined) return undefined;
  const rewritten = written(held, column, row);
  return {
    text: `${text.slice(0, held.at)}${rewritten}${text.slice(held.end)}`,
    caret: held.at + rewritten.length
  };
};

/** What F4 does: the four lockings in the order a spreadsheet cycles them. */
export const anchored = (text: string, caret: number): Anchored | undefined => {
  const held = referenceAt(text, caret);
  if (held === undefined) return undefined;
  const wanted =
    !held.column && !held.row
      ? [true, true]
      : held.column && held.row
        ? [false, true]
        : !held.column && held.row
          ? [true, false]
          : [false, false];
  return lockedAt(text, caret, wanted[0], wanted[1]);
};
