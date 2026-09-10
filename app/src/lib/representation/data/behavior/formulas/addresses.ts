import type { Id } from "$representation/data/types/core/id";
import { isResourceRef } from "$representation/data/behavior/core/resource";
import type { Address } from "$representation/data/types/formulas/expression";

/**
 * How an id is written inside a stored formula.
 *
 * Backticks, because nothing else in the language uses one, so a reference can
 * be lifted out of a formula by scanning rather than by parsing. Inside them the
 * parts are separated by a pipe, which no id contains: a row is `r4`, a column
 * is `c5`, and a resource is `spreadsheets:1`.
 *
 *     `cell|spreadsheets:1|r4|c5`
 *     `range|spreadsheets:1|r4|c5|r17|c5`
 *     `resource|spreadsheet|spreadsheets:1`
 *
 * Nobody types this. The sheet writes it when a formula is stored and reads it
 * back to draw `E4` again.
 */
export const ADDRESS_MARK = "`";

const PART = /^[^`|]+$/;

export const writeAddress = (address: Address): string => {
  if (address.at === "resource") return ["resource", address.ref.kind, address.ref.id].join("|");
  if (address.at === "cell") {
    return ["cell", address.resourceId, address.cell.rowId, address.cell.columnId].join("|");
  }
  return [
    "range",
    address.resourceId,
    address.range.from.rowId,
    address.range.from.columnId,
    address.range.to.rowId,
    address.range.to.columnId
  ].join("|");
};

/** The same, wrapped as it appears in a formula's text. */
export const addressText = (address: Address): string =>
  `${ADDRESS_MARK}${writeAddress(address)}${ADDRESS_MARK}`;

export const readAddress = (source: string): Address | undefined => {
  const parts = source.split("|");
  if (!parts.every((part) => PART.test(part))) return undefined;

  const [tag, ...rest] = parts;
  if (tag === "resource" && rest.length === 2) {
    const ref = { kind: rest[0], id: rest[1] };
    return isResourceRef(ref) ? { at: "resource", ref } : undefined;
  }
  if (tag === "cell" && rest.length === 3) {
    return {
      at: "cell",
      resourceId: rest[0] as Id<"spreadsheets">,
      cell: { rowId: rest[1], columnId: rest[2] }
    };
  }
  if (tag === "range" && rest.length === 5) {
    return {
      at: "range",
      resourceId: rest[0] as Id<"spreadsheets">,
      range: { from: { rowId: rest[1], columnId: rest[2] }, to: { rowId: rest[3], columnId: rest[4] } }
    };
  }
  return undefined;
};

export const sameAddress = (left: Address, right: Address): boolean =>
  writeAddress(left) === writeAddress(right);

/**
 * Every address written into a formula, in the order they appear.
 *
 * Read by scanning for the mark rather than by parsing, so a formula whose text
 * is broken still says what it points at — which is what the stored dependency
 * graph is rebuilt from.
 */
export const addressesIn = (text: string): readonly Address[] => {
  const found: Address[] = [];
  let at = 0;
  for (;;) {
    const opened = text.indexOf(ADDRESS_MARK, at);
    if (opened === -1) break;
    const closed = text.indexOf(ADDRESS_MARK, opened + 1);
    if (closed === -1) break;
    const address = readAddress(text.slice(opened + 1, closed));
    if (address !== undefined) found.push(address);
    at = closed + 1;
  }
  return found;
};
