import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import {
  gridOf,
  indexOf,
  keyOf,
  parseRange,
  parseRef,
  rectOf,
  refsIn,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { isAnchor, spanCovering, spillSpans } from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { ERRORS, displayOf, sameValue } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Datum = number | string | boolean | undefined;

export type Answer =
  | { readonly kind: "value"; readonly value: Datum }
  | { readonly kind: "error"; readonly error: string }
  | { readonly kind: "unsupported" };

type Held = Datum | readonly Datum[];

class Refused {
  constructor(
    readonly error: string | undefined,
    readonly unsupported: boolean
  ) {}
}

const fail = (error: string): never => {
  throw new Refused(error, false);
};

const beyond = (): never => {
  throw new Refused(undefined, true);
};

type Token =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "word"; value: string }
  | { kind: "address"; value: string }
  | { kind: "operator"; value: string };

const PATTERN =
  /\s+|"([^"]*)"|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(?:'[^']+'|[A-Za-z_][A-Za-z0-9_]*)!\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(])|([A-Za-z_][A-Za-z0-9_.]*)|(<=|>=|<>|[-+*/^&=<>%(),])/y

const tokensOf = (text: string): Token[] => {
  const found: Token[] = [];
  PATTERN.lastIndex = 0;
  while (PATTERN.lastIndex < text.length) {
    const at = PATTERN.lastIndex;
    const match = PATTERN.exec(text);
    if (match === null || PATTERN.lastIndex === at) fail("#ERROR!");
    const [whole, quoted, digits, address, word, operator] = match as RegExpExecArray;
    if (whole.trim() === "") continue;
    if (whole.includes("!")) beyond();
    if (quoted !== undefined) found.push({ kind: "text", value: quoted });
    else if (digits !== undefined) found.push({ kind: "number", value: Number(digits) });
    else if (address !== undefined) found.push({ kind: "address", value: address });
    else if (word !== undefined) found.push({ kind: "word", value: word });
    else if (operator !== undefined) found.push({ kind: "operator", value: operator });
    else fail("#ERROR!");
  }
  return found;
};

type Node =
  | { kind: "literal"; value: Datum }
  | { kind: "cell"; text: string }
  | { kind: "span"; text: string }
  | { kind: "name"; text: string }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "unary"; operator: string; operand: Node }
  | { kind: "percent"; operand: Node }
  | { kind: "binary"; operator: string; left: Node; right: Node };

const BINDING: Record<string, number> = {
  "=": 1,
  "<>": 1,
  "<": 1,
  ">": 1,
  "<=": 1,
  ">=": 1,
  "&": 2,
  "+": 3,
  "-": 3,
  "*": 4,
  "/": 4,
  "^": 5
};

const parse = (tokens: readonly Token[]): Node => {
  let at = 0;
  const peek = (): Token | undefined => tokens[at];
  const eat = (value: string) => {
    const token = tokens[at];
    if (token?.kind !== "operator" || token.value !== value) fail("#ERROR!");
    at += 1;
  };

  const primary = (): Node => {
    const token = tokens[at];
    if (token === undefined) fail("#ERROR!");
    at += 1;

    if (token.kind === "number") return { kind: "literal", value: token.value };
    if (token.kind === "text") return { kind: "literal", value: token.value };
    if (token.kind === "address") return token.value.includes(":") ? { kind: "span", text: token.value } : { kind: "cell", text: token.value };
    if (token.kind === "word") {
      const upper = token.value.toUpperCase();
      const next = peek();
      if (next?.kind === "operator" && next.value === "(") {
        at += 1;
        const args: Node[] = [];
        const closing = peek();
        if (closing?.kind === "operator" && closing.value === ")") at += 1;
        else {
          for (;;) {
            args.push(expression(0));
            const separator = peek();
            if (separator?.kind === "operator" && separator.value === ",") {
              at += 1;
              continue;
            }
            eat(")");
            break;
          }
        }
        return { kind: "call", name: upper, args };
      }
      if (upper === "TRUE" || upper === "FALSE") return { kind: "literal", value: upper === "TRUE" };
      return { kind: "name", text: token.value };
    }

    if (token.value === "(") {
      const held = expression(0);
      eat(")");
      return held;
    }
    if (token.value === "-" || token.value === "+") {
      return { kind: "unary", operator: token.value, operand: unary() };
    }
    return fail("#ERROR!");
  };

  const unary = (): Node => {
    let held = primary();
    for (;;) {
      const token = peek();
      if (token?.kind === "operator" && token.value === "%") {
        at += 1;
        held = { kind: "percent", operand: held };
        continue;
      }
      return held;
    }
  };

  const expression = (binding: number): Node => {
    let left = unary();
    for (;;) {
      const token = peek();
      if (token?.kind !== "operator") return left;
      const power = BINDING[token.value];
      if (power === undefined || power < binding) return left;
      at += 1;
      const right = expression(token.value === "^" ? power : power + 1);
      left = { kind: "binary", operator: token.value, left, right };
    }
  };

  const held = expression(0);
  if (at < tokens.length) fail("#ERROR!");
  return held;
};

const flat = (held: Held): Datum[] => (Array.isArray(held) ? [...held] : [held as Datum]);

const numberOf = (held: Held): number => {
  const [datum] = flat(held);
  if (Array.isArray(held) && held.length !== 1) fail("#VALUE!");
  if (datum === undefined) return 0;
  if (typeof datum === "number") return datum;
  if (typeof datum === "boolean") return datum ? 1 : 0;
  const parsed = Number(datum.replace(/,/g, "").trim());
  if (datum.trim() === "" || !Number.isFinite(parsed)) return fail("#VALUE!");
  return parsed;
};

const textOf = (held: Held): string => {
  const [datum] = flat(held);
  if (datum === undefined) return "";
  if (typeof datum === "string") return datum;
  if (typeof datum === "boolean") return datum ? "TRUE" : "FALSE";
  return String(datum);
};

const logicOf = (held: Held): boolean => {
  const [datum] = flat(held);
  if (typeof datum === "boolean") return datum;
  if (typeof datum === "number") return datum !== 0;
  if (datum === undefined) return false;
  const word = datum.trim().toUpperCase();
  if (word === "TRUE") return true;
  if (word === "FALSE") return false;
  return fail("#VALUE!");
};

const numbersIn = (held: readonly Held[]): number[] =>
  held.flatMap(flat).flatMap((datum) => {
    if (typeof datum === "number") return [datum];
    if (typeof datum === "boolean") return [datum ? 1 : 0];
    return [];
  });

const compare = (left: Datum, right: Datum): number => {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" || typeof right === "boolean") {
    return (logicOf(left) ? 1 : 0) - (logicOf(right) ? 1 : 0);
  }
  const a = left === undefined ? "" : String(left);
  const b = right === undefined ? "" : String(right);
  return a.toLowerCase().localeCompare(b.toLowerCase());
};

const matches = (datum: Datum, test: Datum): boolean => {
  if (typeof test === "string") {
    const trimmed = test.trim();
    const operator = /^(<=|>=|<>|<|>|=)(.*)$/.exec(trimmed);
    if (operator !== null) {
      const [, symbol, rest] = operator;
      const wanted: Datum = rest.trim() === "" ? "" : Number.isFinite(Number(rest)) ? Number(rest) : rest;
      const order = compare(datum, wanted);
      if (symbol === "=") return order === 0;
      if (symbol === "<>") return order !== 0;
      if (symbol === "<") return order < 0;
      if (symbol === ">") return order > 0;
      if (symbol === "<=") return order <= 0;
      return order >= 0;
    }
  }
  return compare(datum, test) === 0;
};

const rounded = (value: number, digits: number): number => {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

const percentile = (values: readonly number[], fraction: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return fail("#N/A");
  const at = (sorted.length - 1) * Math.min(1, Math.max(0, fraction));
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};

const median = (values: readonly number[]): number => percentile(values, 0.5);

type Call = (args: readonly Held[]) => Held;

const CALLS: Record<string, Call> = {
  SUM: (args) => numbersIn(args).reduce((total, value) => total + value, 0),
  ROUND: (args) => rounded(numberOf(args[0]), args.length > 1 ? numberOf(args[1]) : 0),
  ABS: (args) => Math.abs(numberOf(args[0])),
  SQRT: (args) => {
    const value = numberOf(args[0]);
    return value < 0 ? fail("#NUM!") : Math.sqrt(value);
  },
  POWER: (args) => numberOf(args[0]) ** numberOf(args[1]),
  MEAN: (args) => {
    const values = numbersIn(args);
    return values.length === 0 ? fail("#DIV/0!") : values.reduce((total, value) => total + value, 0) / values.length;
  },
  MEDIAN: (args) => median(numbersIn(args)),
  PERCENTILE: (args) => percentile(numbersIn([args[0]]), numberOf(args[1])),
  MIN: (args) => {
    const values = numbersIn(args);
    return values.length === 0 ? 0 : Math.min(...values);
  },
  MAX: (args) => {
    const values = numbersIn(args);
    return values.length === 0 ? 0 : Math.max(...values);
  },
  COUNT: (args) => numbersIn(args).length,
  COUNTA: (args) => args.flatMap(flat).filter((datum) => datum !== undefined && datum !== "").length,
  COUNTIF: (args) => args[0] === undefined ? fail("#VALUE!") : flat(args[0]).filter((datum) => matches(datum, flat(args[1])[0])).length,
  SUMIF: (args) => {
    const range = flat(args[0]);
    const totals = args.length > 2 ? flat(args[2]) : range;
    let sum = 0;
    range.forEach((datum, index) => {
      if (!matches(datum, flat(args[1])[0])) return;
      const value = totals[index];
      if (typeof value === "number") sum += value;
    });
    return sum;
  },
  IF: (args) => (logicOf(args[0]) ? flat(args[1])[0] : args.length > 2 ? flat(args[2])[0] : false),
  IFERROR: (args) => flat(args[0])[0],
  AND: (args) => args.flatMap(flat).every((datum) => logicOf(datum)),
  OR: (args) => args.flatMap(flat).some((datum) => logicOf(datum)),
  NOT: (args) => !logicOf(args[0]),
  CONCAT: (args) => args.flatMap(flat).map((datum) => textOf(datum)).join(""),
  CONCATENATE: (args) => args.flatMap(flat).map((datum) => textOf(datum)).join(""),
  UPPER: (args) => textOf(args[0]).toUpperCase(),
  LOWER: (args) => textOf(args[0]).toLowerCase(),
  TRIM: (args) => textOf(args[0]).trim(),
  LEN: (args) => textOf(args[0]).length
};

const ARRAY_CALLS = new Set(["FILTER", "UNIQUE", "SORT", "TRANSPOSE", "SEQUENCE", "SPLIT"]);

export type Reader = (ref: CellRef) => Datum;

const carried = (datum: Datum): Datum =>
  typeof datum === "string" && datum in ERRORS ? fail(datum) : datum;

const evaluateNode = (node: Node, grid: Grid, read: Reader): Held => {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "cell": {
      const ref = parseRef(grid, node.text.replace(/\$/g, ""));
      return ref === undefined ? fail("#REF!") : carried(read(ref));
    }
    case "span": {
      const range = parseRange(grid, node.text.replace(/\$/g, ""));
      const rect = range === undefined ? undefined : rectOf(grid, range);
      if (rect === undefined) return fail("#REF!");
      return refsIn(grid, rect).map((at) => carried(read(at)));
    }
    case "name":
      return fail("#NAME?");
    case "call": {
      if (ARRAY_CALLS.has(node.name)) return beyond();
      const call = CALLS[node.name];
      if (call === undefined) return fail("#NAME?");
      if (node.name === "IF") {
        return logicOf(evaluateNode(node.args[0], grid, read))
          ? flat(evaluateNode(node.args[1], grid, read))[0]
          : node.args.length > 2
            ? flat(evaluateNode(node.args[2], grid, read))[0]
            : false;
      }
      if (node.name === "IFERROR") {
        try {
          return flat(evaluateNode(node.args[0], grid, read))[0];
        } catch (thrown) {
          if (thrown instanceof Refused && !thrown.unsupported) {
            return node.args.length > 1 ? flat(evaluateNode(node.args[1], grid, read))[0] : "";
          }
          throw thrown;
        }
      }
      return call(node.args.map((argument) => evaluateNode(argument, grid, read)));
    }
    case "unary": {
      const value = numberOf(evaluateNode(node.operand, grid, read));
      return node.operator === "-" ? -value : value;
    }
    case "percent":
      return numberOf(evaluateNode(node.operand, grid, read)) / 100;
    case "binary": {
      const left = evaluateNode(node.left, grid, read);
      const right = evaluateNode(node.right, grid, read);
      switch (node.operator) {
        case "+":
          return numberOf(left) + numberOf(right);
        case "-":
          return numberOf(left) - numberOf(right);
        case "*":
          return numberOf(left) * numberOf(right);
        case "/": {
          const divisor = numberOf(right);
          return divisor === 0 ? fail("#DIV/0!") : numberOf(left) / divisor;
        }
        case "^":
          return numberOf(left) ** numberOf(right);
        case "&":
          return `${textOf(left)}${textOf(right)}`;
        case "=":
          return compare(flat(left)[0], flat(right)[0]) === 0;
        case "<>":
          return compare(flat(left)[0], flat(right)[0]) !== 0;
        case "<":
          return compare(flat(left)[0], flat(right)[0]) < 0;
        case ">":
          return compare(flat(left)[0], flat(right)[0]) > 0;
        case "<=":
          return compare(flat(left)[0], flat(right)[0]) <= 0;
        default:
          return compare(flat(left)[0], flat(right)[0]) >= 0;
      }
    }
  }
};

export const datumOf = (cell: SheetCell | undefined): Datum => {
  const value = cell?.value;
  switch (value?.kind) {
    case undefined:
    case "empty":
      return undefined;
    case "number":
      return value.value;
    case "logic":
      return value.value;
    case "text":
      return value.value;
    default:
      return displayOf(value);
  }
};

export const evaluate = (expression: string, grid: Grid, read: Reader): Answer => {
  const body = expression.startsWith("=") ? expression.slice(1) : expression;
  if (body.trim() === "") return { kind: "unsupported" };
  try {
    const held = flat(evaluateNode(parse(tokensOf(body)), grid, read))[0];
    if (typeof held === "string" && held in ERRORS) return { kind: "error", error: held };
    return { kind: "value", value: held };
  } catch (thrown) {
    if (thrown instanceof Refused) {
      return thrown.unsupported ? { kind: "unsupported" } : { kind: "error", error: thrown.error ?? "#ERROR!" };
    }
    return { kind: "error", error: "#ERROR!" };
  }
};

const valueOf = (answer: Answer): FormulaValue | undefined => {
  if (answer.kind === "unsupported") return undefined;
  if (answer.kind === "error") return { kind: "text", value: answer.error };
  const held = answer.value;
  if (held === undefined) return { kind: "empty" };
  if (typeof held === "number") return Number.isFinite(held) ? { kind: "number", value: held } : { kind: "text", value: "#NUM!" };
  if (typeof held === "boolean") return { kind: "logic", value: held };
  return { kind: "text", value: held };
};

const dependencies = (expression: string, grid: Grid): string[] => {
  try {
    const body = expression.startsWith("=") ? expression.slice(1) : expression;
    const found: string[] = [];
    for (const token of tokensOf(body)) {
      if (token.kind !== "address") continue;
      const plain = token.value.replace(/\$/g, "");
      if (plain.includes(":")) {
        const range = parseRange(grid, plain);
        const rect = range === undefined ? undefined : rectOf(grid, range);
        if (rect !== undefined) found.push(...refsIn(grid, rect).map(keyOf));
        continue;
      }
      const ref = parseRef(grid, plain);
      if (ref !== undefined) found.push(keyOf(ref));
    }
    return found;
  } catch {
    return [];
  }
};

const ordered = (sheet: LiveSheet, grid: Grid, keys: readonly string[]): { readonly order: string[]; readonly cyclic: string[] } => {
  const held = new Set(keys);
  const needs = new Map<string, string[]>();
  const feeds = new Map<string, string[]>();
  const waiting = new Map<string, number>();

  for (const key of keys) {
    const cell = sheet.cells[key];
    const wanted = [...new Set(dependencies(cell?.expression ?? "", grid).filter((other) => held.has(other) && other !== key))];
    needs.set(key, wanted);
    waiting.set(key, wanted.length);
    for (const other of wanted) feeds.set(other, [...(feeds.get(other) ?? []), key]);
  }

  const queue = keys.filter((key) => (waiting.get(key) ?? 0) === 0);
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

  return { order, cyclic: keys.filter((key) => !order.includes(key)) };
};

export const recalculated = (sheet: LiveSheet, grid: Grid): SpreadsheetOp[] => {
  const spills = spillSpans(sheet, grid);
  const formulas = Object.values(sheet.cells).filter((cell) => {
    if (cell.expression === undefined) return false;
    const at = indexOf(grid, { rowId: cell.rowId, columnId: cell.columnId });
    if (at === undefined) return false;
    const spill = spanCovering(spills, at.row, at.column);
    return spill === undefined || isAnchor(spill, at.row, at.column);
  });

  const keys = formulas.map((cell) => keyOf({ rowId: cell.rowId, columnId: cell.columnId }));
  const { order, cyclic } = ordered(sheet, grid, keys);
  const computed = new Map<string, Datum>();
  const read: Reader = (ref) => {
    const key = keyOf(ref);
    return computed.has(key) ? computed.get(key) : datumOf(sheet.cells[key]);
  };

  const ops: SpreadsheetOp[] = [];
  const write = (key: string, value: FormulaValue | undefined) => {
    if (value === undefined) return;
    const held = sheet.cells[key];
    if (held === undefined || sameValue(held.value, value)) return;
    ops.push({ op: "set", target: "cell", path: `${key}/value`, value, was: held.value });
  };

  for (const key of order) {
    const cell = sheet.cells[key];
    const answer = evaluate(cell?.expression ?? "", grid, read);
    const value = valueOf(answer);
    if (value !== undefined) computed.set(key, datumOf({ ...(cell as SheetCell), value }));
    write(key, value);
  }
  for (const key of cyclic) write(key, { kind: "text", value: "#CYCLE!" });

  return ops;
};

export const withRecalculation = (sheet: LiveSheet, ops: readonly SpreadsheetOp[]): SpreadsheetOp[] => {
  if (ops.length === 0) return [];
  try {
    const next = applyOps(sheet, ops);
    return [...ops, ...recalculated(next, gridOf(next.body))];
  } catch {
    return [...ops];
  }
};
