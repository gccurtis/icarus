const TOKEN = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;

export type Anchored = { readonly text: string; readonly caret: number };

const next = (column: string, row: string): string => {
  if (column === "" && row === "") return "$$";
  if (column === "$" && row === "$") return "_$";
  if (column === "" && row === "$") return "$_";
  return "__";
};

export const anchored = (text: string, caret: number): Anchored | undefined => {
  TOKEN.lastIndex = 0;
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (caret < at || caret > end) continue;
    const [, column, letters, row, digits] = match;
    const wanted = next(column, row);
    const rewritten = `${wanted[0] === "$" ? "$" : ""}${letters}${wanted[1] === "$" ? "$" : ""}${digits}`;
    return { text: `${text.slice(0, at)}${rewritten}${text.slice(end)}`, caret: at + rewritten.length };
  }
  return undefined;
};
