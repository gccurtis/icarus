import { addressesIn } from "$representation/data/behavior/formulas/addresses";
import { evaluate } from "$representation/data/behavior/formulas/evaluate";
import { parseFormula } from "$representation/data/behavior/formulas/parse";
import { answering, refusing } from "$representation/data/behavior/formulas/refusals";
import { sameValue } from "$representation/data/behavior/formulas/values";
import {
  gridOf,
  indexOf,
  keyOf,
  rectOf,
  refsIn,
  type Grid
} from "$representation/data/behavior/spreadsheets/addressing";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { CellRef, FormulaColumn, FormulaValue } from "$representation/data/types/content/formula-value";
import type { Id } from "$representation/data/types/core/id";
import type { Address } from "$representation/data/types/formulas/expression";
import type { Answer, Refusal } from "$representation/data/types/formulas/refusal";
import type { Resolver } from "$representation/data/types/formulas/resolver";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

/** One sheet, and enough of it to answer for a cell. */
export type SheetSource = {
  readonly resourceId: Id<"spreadsheets">;
  readonly sheet: LiveSheet;
  readonly grid: Grid;
};

/** What a sheet can reach beyond itself while a formula is being answered. */
export type Surroundings = {
  readonly variable?: (name: string) => FormulaValue | undefined;
  readonly sheetAt?: (resourceId: string) => SheetSource | undefined;
};

export const sourceOf = (resourceId: Id<"spreadsheets">, sheet: LiveSheet): SheetSource => ({
  resourceId,
  sheet,
  grid: gridOf(sheet.body)
});

const EMPTY: FormulaValue = { kind: "empty" };

const answerOfCell = (source: SheetSource, ref: CellRef): Answer => {
  const held = source.sheet.cells[keyOf(ref)];
  if (held?.failure !== undefined) return refusing(held.failure);
  return answering(held?.value ?? EMPTY);
};

/**
 * A sheet read as a table.
 *
 * Only the part of the grid anything was written into, so an empty column at the
 * far right is not a field. The first used row names the columns when every one
 * of them holds text and no two agree; otherwise the columns have no names and
 * the sheet is sliced by position.
 */
const tableOfSheet = (source: SheetSource): FormulaValue => {
  const used = Object.values(source.sheet.cells).filter((cell) => cell.value.kind !== "empty");
  const rows = source.grid.rows.filter((row) => used.some((cell) => cell.rowId === row.id));
  const columns = source.grid.columns.filter((column) => used.some((cell) => cell.columnId === column.id));
  if (rows.length === 0 || columns.length === 0) return { kind: "table", columns: [], rows: [] };

  const at = (row: number, column: number): FormulaValue =>
    source.sheet.cells[`${rows[row].id}/${columns[column].id}`]?.value ?? EMPTY;

  const heads = columns.map((_, column) => at(0, column));
  const names = heads.map((head) => (head.kind === "text" ? head.value : undefined));
  const heading = names.every((name) => name !== undefined) && new Set(names).size === names.length;

  const named: FormulaColumn[] = heading ? names.map((name) => ({ name: name as string })) : columns.map(() => ({}));
  const body = rows.slice(heading ? 1 : 0).map((_, offset) =>
    columns.map((_, column) => at(offset + (heading ? 1 : 0), column))
  );
  return { kind: "table", columns: named, rows: body };
};

/**
 * How a sheet answers the formula system.
 *
 * Two questions and nothing else. The engine never learns that a grid was
 * involved, which is the same reason a document block can hold a formula on
 * exactly these terms.
 */
export const sheetResolver = (
  here: SheetSource,
  around: Surroundings = {},
  overlay?: ReadonlyMap<string, Answer>
): Resolver => {
  const sourceFor = (resourceId: string): SheetSource | undefined =>
    resourceId === here.resourceId ? here : around.sheetAt?.(resourceId);

  const cellAnswer = (source: SheetSource, ref: CellRef): Answer | null => {
    if (indexOf(source.grid, ref) === undefined) return null;
    const key = keyOf(ref);
    if (source === here && overlay?.has(key) === true) return overlay.get(key) as Answer;
    return answerOfCell(source, ref);
  };

  return {
    variable: (name) => {
      const held = around.variable?.(name);
      return held === undefined ? null : answering(held);
    },
    address: (address: Address): Answer | null => {
      if (address.at === "resource") {
        const source = sourceFor(address.ref.id);
        return source === undefined ? null : answering(tableOfSheet(source));
      }
      const source = sourceFor(address.resourceId);
      if (source === undefined) return null;

      if (address.at === "cell") return cellAnswer(source, address.cell);

      const rect = rectOf(source.grid, address.range);
      if (rect === undefined) return null;
      const refs = refsIn(source.grid, rect);
      const answers = refs.map((ref) => cellAnswer(source, ref) ?? answering(EMPTY));
      const refused = answers.find((answer) => !answer.ok);
      if (refused !== undefined) return refused;

      const values = answers.map((answer) => (answer.ok ? answer.value : EMPTY));
      if (rect.rows === 1 || rect.columns === 1) return answering({ kind: "list", values });
      const rows: FormulaValue[][] = [];
      for (let row = 0; row < rect.rows; row += 1) {
        rows.push(values.slice(row * rect.columns, (row + 1) * rect.columns));
      }
      return answering({ kind: "table", columns: Array.from({ length: rect.columns }, () => ({})), rows });
    }
  };
};

/** Every cell in this sheet a stored formula reads, as keys. */
export const dependenciesOf = (source: SheetSource, expression: string): readonly string[] => {
  const keys: string[] = [];
  for (const address of addressesIn(expression)) {
    if (address.at === "resource") continue;
    if (address.resourceId !== source.resourceId) continue;
    if (address.at === "cell") {
      keys.push(keyOf(address.cell));
      continue;
    }
    const rect = rectOf(source.grid, address.range);
    if (rect === undefined) continue;
    for (const ref of refsIn(source.grid, rect)) keys.push(keyOf(ref));
  }
  return keys;
};

/** Kahn's order over the formula cells, and whatever will not sort. */
const ordered = (source: SheetSource, keys: readonly string[]): { order: string[]; cyclic: string[] } => {
  const held = new Set(keys);
  const needs = new Map<string, Set<string>>();
  const feeds = new Map<string, string[]>();
  const waiting = new Map<string, number>();

  for (const key of keys) {
    const cell = source.sheet.cells[key];
    const wants = new Set(
      dependenciesOf(source, cell?.expression ?? "").filter((other) => held.has(other) && other !== key)
    );
    needs.set(key, wants);
    waiting.set(key, wants.size);
    for (const other of wants) feeds.set(other, [...(feeds.get(other) ?? []), key]);
  }

  const queue = keys.filter((key) => waiting.get(key) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const key = queue.shift() as string;
    order.push(key);
    for (const next of feeds.get(key) ?? []) {
      const left = (waiting.get(next) ?? 0) - 1;
      waiting.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  const reached = new Set(order);
  return { order, cyclic: keys.filter((key) => !reached.has(key)) };
};

const CYCLE: Refusal = { token: "#CYCLE!" };

/**
 * Every formula in the sheet, answered in dependency order, as the ops that
 * write what changed. A cell that already holds its answer costs no op.
 */
export const recalculated = (source: SheetSource, around: Surroundings = {}): SpreadsheetOp[] => {
  const keys = Object.keys(source.sheet.cells).filter((key) => {
    const cell = source.sheet.cells[key];
    return cell.expression !== undefined && indexOf(source.grid, cell) !== undefined;
  });
  if (keys.length === 0) return [];

  const { order, cyclic } = ordered(source, keys);
  const overlay = new Map<string, Answer>();
  const ops: SpreadsheetOp[] = [];

  const write = (key: string, answer: Answer): void => {
    const held = source.sheet.cells[key];
    if (held === undefined) return;
    const value = answer.ok ? answer.value : EMPTY;
    const failure = answer.ok ? undefined : answer.refusal;

    if (!sameValue(held.value, value)) {
      ops.push({ op: "set", target: "cell", path: `${key}/value`, value, was: held.value });
    }
    if (JSON.stringify(held.failure ?? null) !== JSON.stringify(failure ?? null)) {
      ops.push({
        op: "set",
        target: "cell",
        path: `${key}/failure`,
        value: failure ?? null,
        was: held.failure ?? null
      });
    }
  };

  const resolver = sheetResolver(source, around, overlay);

  /**
   * A formula that reads a sheet nobody handed over is not wrong, it is
   * unanswerable here. The cell keeps what it has rather than being told its
   * reference is broken by a reader who simply could not see that far.
   */
  const outOfReach = (expression: string): boolean =>
    addressesIn(expression).some((address) => {
      const resourceId = address.at === "resource" ? address.ref.id : address.resourceId;
      return resourceId !== source.resourceId && around.sheetAt?.(resourceId) === undefined;
    });

  for (const key of order) {
    const cell = source.sheet.cells[key];
    const read = parseFormula(cell.expression ?? "");
    const answer: Answer = read.ok ? evaluate(read.expression, resolver) : refusing(read.refusal);
    if (!answer.ok && outOfReach(cell.expression ?? "")) {
      overlay.set(key, answering(cell.value));
      continue;
    }
    overlay.set(key, answer);
    write(key, answer);
  }
  for (const key of cyclic) {
    const answer: Answer = refusing(CYCLE);
    overlay.set(key, answer);
    write(key, answer);
  }
  return ops;
};

/**
 * An edit and everything it changes, as one array.
 *
 * The ops are applied to a copy first, so recalculation sees the sheet as it
 * will be rather than as it was, and the caller lands both halves together.
 */
export const withRecalculation = (
  source: SheetSource,
  ops: readonly SpreadsheetOp[],
  around: Surroundings = {}
): SpreadsheetOp[] => {
  if (ops.length === 0) return [];
  try {
    const next = applyOps(source.sheet, ops);
    return [...ops, ...recalculated(sourceOf(source.resourceId, next), around)];
  } catch {
    return [...ops];
  }
};
