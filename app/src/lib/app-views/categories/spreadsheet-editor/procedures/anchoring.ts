// Quoted text is consumed but never offered as a reference. A range is one token.
const TOKEN = /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?<![\w.])(\$?[A-Za-z]{1,3}\$?\d+)(\s*:\s*(\$?[A-Za-z]{1,3}\$?\d+))?(?![\w.(])/g;

export type Anchored = { readonly text: string; readonly caret: number };

type Endpoint = {
  readonly letters: string;
  readonly digits: string;
  readonly column: boolean;
  readonly row: boolean;
};

/** One cell or range, with a lock selected only when both endpoints agree. */
export type Anchor = {
  readonly at: number;
  readonly end: number;
  readonly first: Endpoint;
  readonly last?: Endpoint;
  readonly separator: string;
  readonly column: boolean | undefined;
  readonly row: boolean | undefined;
};

const endpointOf = (text: string): Endpoint => {
  const [, column, letters, row, digits] = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(text)!;
  return { letters, digits, column: column === "$", row: row === "$" };
};

export const referenceAt = (text: string, caret: number): Anchor | undefined => {
  for (const match of text.matchAll(TOKEN)) {
    if (match[1] === undefined) continue;
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (caret < at || caret > end) continue;
    const first = endpointOf(match[1]);
    const last = match[3] === undefined ? undefined : endpointOf(match[3]);
    return {
      at, end, first, last,
      separator: match[2]?.slice(0, -match[3].length) ?? "",
      column: last === undefined || first.column === last.column ? first.column : undefined,
      row: last === undefined || first.row === last.row ? first.row : undefined
    };
  }
  return undefined;
};

const written = (held: Endpoint, column: boolean, row: boolean): string =>
  `${column ? "$" : ""}${held.letters}${row ? "$" : ""}${held.digits}`;

/** The label a reference would carry under one locking, for a control to show. */
export const anchorLabel = (held: Anchor, column: boolean, row: boolean): string =>
  written(held.first, column, row) +
  (held.last === undefined ? "" : held.separator + written(held.last, column, row));

export const lockedAt = (
  text: string,
  caret: number,
  column: boolean,
  row: boolean
): Anchored | undefined => {
  const held = referenceAt(text, caret);
  if (held === undefined) return undefined;
  const rewritten = anchorLabel(held, column, row);
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
