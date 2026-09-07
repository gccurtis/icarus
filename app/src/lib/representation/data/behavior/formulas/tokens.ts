import { fail } from "$representation/data/behavior/formulas/refusals";

export type Token =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "address"; source: string }
  | { kind: "word"; value: string }
  | { kind: "symbol"; value: string };

/**
 * One sticky pattern, tried at the cursor and never scanning ahead, so a
 * character nothing matches is a refusal rather than a silent skip.
 *
 * Order matters twice: a backtick address is taken before anything inside it can
 * be read as a word, and the two-character comparisons are tried before their
 * first characters.
 */
const PATTERN =
  /\s+|`([^`]*)`|"([^"]*)"|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|[()[\]{},:.!+\-*/^&=<>%])/y;

export const tokenise = (text: string): readonly Token[] => {
  const tokens: Token[] = [];
  PATTERN.lastIndex = 0;

  while (PATTERN.lastIndex < text.length) {
    const at = PATTERN.lastIndex;
    const found = PATTERN.exec(text);
    if (found === null || PATTERN.lastIndex === at) fail("#ERROR!");

    const [, address, quoted, number, word, symbol] = found as RegExpExecArray;
    if (address !== undefined) tokens.push({ kind: "address", source: address });
    else if (quoted !== undefined) tokens.push({ kind: "text", value: quoted });
    else if (number !== undefined) tokens.push({ kind: "number", value: Number(number) });
    else if (word !== undefined) tokens.push({ kind: "word", value: word });
    else if (symbol !== undefined) tokens.push({ kind: "symbol", value: symbol });
  }
  return tokens;
};
