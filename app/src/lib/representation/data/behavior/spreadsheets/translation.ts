import { ADDRESS_MARK, addressText, readAddress } from "$representation/data/behavior/formulas/addresses";
import {
  indexOf,
  labelOf,
  parseRange,
  parseRef,
  refAt,
  type Grid
} from "$representation/data/behavior/spreadsheets/addressing";
import type { CellRef } from "$representation/data/types/content/formula-value";
import type { Id } from "$representation/data/types/core/id";
import type { Address } from "$representation/data/types/formulas/expression";

/** What a sheet has to know about another sheet to say its name. */
export type SheetFacts = {
  readonly resourceId: Id<"spreadsheets">;
  readonly title: string;
  readonly grid: Grid;
};

/**
 * A formula and the locks that go with it.
 *
 * The dollar signs are not in the formula. They tell copy and paste which half
 * of an address to shift, which is a spreadsheet gesture about spreadsheet
 * editing, so a locked and an unlocked reference to the same cell are the same
 * formula and differ only in what the sheet remembers beside it. One mask per
 * address, in the order they appear.
 */
export type Translated = {
  readonly formula: string;
  readonly anchors: readonly string[];
};

/**
 * Where a formula's two spellings meet.
 *
 * A person types `E4*60/C4`, which means something only in the sheet they typed
 * it in. A formula is project global, so what is stored names the cells
 * themselves. Translation runs on the way in and again on the way out, and the
 * formula system never learns that either spelling exists.
 */
const TYPED =
  /\s+|("(?:[^"]*)")|(`[^`]*`)|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)|(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(])|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|[()[\]{},:.!+\-*/^&=<>%])/y;

const NOWHERE = "?";

const bare = (text: string): string => text.replace(/\$/g, "");

/** Which half of one written reference is held still: `c`, `r`, both or neither. */
const maskOf = (text: string): string => {
  const match = /^(\$?)[A-Za-z]{1,3}(\$?)\d+$/.exec(text);
  if (match === null) return "";
  return `${match[1] === "$" ? "c" : ""}${match[2] === "$" ? "r" : ""}`;
};

const anchorOf = (text: string): string =>
  text.includes(":") ? text.split(":").map(maskOf).join(":") : maskOf(text);

const locked = (label: string, mask: string): string => {
  const match = /^([A-Za-z]{1,3})(\d+)$/.exec(label);
  if (match === null) return label;
  return `${mask.includes("c") ? "$" : ""}${match[1]}${mask.includes("r") ? "$" : ""}${match[2]}`;
};

const addressOf = (facts: SheetFacts, text: string): Address => {
  const plain = bare(text);
  if (!plain.includes(":")) {
    const cell = parseRef(facts.grid, plain);
    return cell === undefined
      ? { at: "cell", resourceId: facts.resourceId, cell: { rowId: NOWHERE, columnId: NOWHERE } }
      : { at: "cell", resourceId: facts.resourceId, cell };
  }
  const range = parseRange(facts.grid, plain);
  return range === undefined
    ? {
        at: "range",
        resourceId: facts.resourceId,
        range: { from: { rowId: NOWHERE, columnId: NOWHERE }, to: { rowId: NOWHERE, columnId: NOWHERE } }
      }
    : { at: "range", resourceId: facts.resourceId, range };
};

/** What a person typed, rewritten so every reference names ids. */
export const toStored = (
  text: string,
  here: SheetFacts,
  byTitle?: (title: string) => SheetFacts | undefined
): Translated => {
  const leads = text.startsWith("=");
  const source = leads ? text.slice(1) : text;
  const anchors: string[] = [];
  let written = "";
  TYPED.lastIndex = 0;

  while (TYPED.lastIndex < source.length) {
    const at = TYPED.lastIndex;
    const found = TYPED.exec(source);
    if (found === null || TYPED.lastIndex === at) return { formula: text, anchors: [] };

    const [whole, , , , titled, named, qualified, local] = found as RegExpExecArray;
    if (qualified !== undefined) {
      const other = byTitle?.(titled ?? named ?? "");
      const facts = other ?? { ...here, grid: { ...here.grid, rows: [], columns: [] } };
      written += addressText(addressOf(facts, qualified));
      anchors.push(anchorOf(qualified));
    } else if (local !== undefined) {
      written += addressText(addressOf(here, local));
      anchors.push(anchorOf(local));
    } else written += whole;
  }
  return { formula: `${leads ? "=" : ""}${written}`, anchors };
};

const shown = (
  address: Address,
  mask: string,
  here: SheetFacts,
  byId?: (id: string) => SheetFacts | undefined
): string => {
  if (address.at === "resource") return address.ref.id;

  const facts = address.resourceId === here.resourceId ? here : byId?.(address.resourceId);
  if (facts === undefined) return "#REF!";

  const [from, to] = mask.includes(":") ? mask.split(":") : [mask, mask];
  const label =
    address.at === "cell"
      ? locked(labelOf(facts.grid, address.cell), from)
      : `${locked(labelOf(facts.grid, address.range.from), from)}:${locked(labelOf(facts.grid, address.range.to), to)}`;
  if (label.includes("?")) return "#REF!";

  if (facts.resourceId === here.resourceId) return label;
  const title = /^[A-Za-z_][A-Za-z0-9_]*$/.test(facts.title) ? facts.title : `'${facts.title}'`;
  return `${title}!${label}`;
};

const moved = (grid: Grid, ref: CellRef, rows: number, columns: number, mask: string): CellRef => {
  const at = indexOf(grid, ref);
  if (at === undefined) return { rowId: NOWHERE, columnId: NOWHERE };
  const next = refAt(grid, at.row + (mask.includes("r") ? 0 : rows), at.column + (mask.includes("c") ? 0 : columns));
  return next ?? { rowId: NOWHERE, columnId: NOWHERE };
};

/**
 * The same formula, one row down or one column across.
 *
 * This is where the locks earn their keep: a half of an address whose mask holds
 * it still does not move. Nothing else about the formula changes, and an address
 * that would land off the grid becomes one nothing answers for.
 */
export const shifted = (
  formula: string,
  anchors: readonly string[],
  grid: Grid,
  rows: number,
  columns: number
): string => {
  let written = "";
  let at = 0;
  let seen = 0;
  for (;;) {
    const opened = formula.indexOf(ADDRESS_MARK, at);
    if (opened === -1) break;
    const closed = formula.indexOf(ADDRESS_MARK, opened + 1);
    if (closed === -1) break;

    const address = readAddress(formula.slice(opened + 1, closed));
    const mask = anchors[seen] ?? "";
    const [from, to] = mask.includes(":") ? mask.split(":") : [mask, mask];
    seen += 1;

    let next = formula.slice(opened, closed + 1);
    if (address?.at === "cell") {
      next = addressText({ ...address, cell: moved(grid, address.cell, rows, columns, from) });
    } else if (address?.at === "range") {
      next = addressText({
        ...address,
        range: {
          from: moved(grid, address.range.from, rows, columns, from),
          to: moved(grid, address.range.to, rows, columns, to)
        }
      });
    }
    written += formula.slice(at, opened) + next;
    at = closed + 1;
  }
  return written + formula.slice(at);
};

/** What is stored, drawn the way the sheet that holds it reads. */
export const toShown = (
  formula: string,
  here: SheetFacts,
  options: {
    readonly byId?: (id: string) => SheetFacts | undefined;
    readonly anchors?: readonly string[];
  } = {}
): string => {
  let written = "";
  let at = 0;
  let seen = 0;
  for (;;) {
    const opened = formula.indexOf(ADDRESS_MARK, at);
    if (opened === -1) break;
    const closed = formula.indexOf(ADDRESS_MARK, opened + 1);
    if (closed === -1) break;

    const address = readAddress(formula.slice(opened + 1, closed));
    const mask = options.anchors?.[seen] ?? "";
    seen += 1;
    written +=
      formula.slice(at, opened) + (address === undefined ? "#REF!" : shown(address, mask, here, options.byId));
    at = closed + 1;
  }
  return written + formula.slice(at);
};
