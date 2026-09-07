import { fail, refusalOf } from "$representation/data/behavior/formulas/refusals";
import {
  EMPTY,
  compare,
  flattened,
  isEmpty,
  list,
  logic,
  logicOf,
  number,
  numberOf,
  numbersIn,
  text,
  textOf
} from "$representation/data/behavior/formulas/values";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Expression } from "$representation/data/types/formulas/expression";

/** A function over values that are already computed. */
export type Call = (values: readonly FormulaValue[]) => FormulaValue;

/** A function that decides for itself which of its arguments to compute. */
export type LazyCall = (args: readonly Expression[], run: (of: Expression) => FormulaValue) => FormulaValue;

const arity = (values: readonly unknown[], least: number, most?: number): void => {
  if (values.length < least || (most !== undefined && values.length > most)) fail("#VALUE!");
};

const scalars = (values: readonly FormulaValue[]): readonly FormulaValue[] => values.flatMap(flattened);

const numbers = (values: readonly FormulaValue[]): readonly number[] => numbersIn(scalars(values));

const statistic = (values: readonly number[], of: (held: readonly number[]) => number): FormulaValue => {
  if (values.length === 0) fail("#N/A");
  return number(of(values));
};

const rounded = (value: number, digits: number): number => {
  const scale = 10 ** digits;
  const lifted = value * scale;
  const away = lifted < 0 ? -Math.round(-lifted) : Math.round(lifted);
  return away / scale;
};

const percentile = (values: readonly number[], fraction: number): number => {
  const sorted = [...values].sort((one, other) => one - other);
  const place = (sorted.length - 1) * fraction;
  const below = Math.floor(place);
  const above = Math.ceil(place);
  if (below === above) return sorted[below];
  return sorted[below] + (sorted[above] - sorted[below]) * (place - below);
};

const median = (values: readonly number[]): number => percentile(values, 0.5);

/** Days since the epoch, computed rather than asked of a clock. */
const daysFromCivil = (year: number, month: number, day: number): number => {
  const shifted = year - (month <= 2 ? 1 : 0);
  const era = Math.floor((shifted >= 0 ? shifted : shifted - 399) / 400);
  const ofEra = shifted - era * 400;
  const ofYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = ofEra * 365 + Math.floor(ofEra / 4) - Math.floor(ofEra / 100) + ofYear;
  return era * 146097 + dayOfEra - 719468;
};

const OPERATORS: readonly string[] = ["<=", ">=", "<>", "<", ">", "="];

/** A criteria argument: a value to equal, or a comparison written as text. */
const matches = (value: FormulaValue, test: FormulaValue): boolean => {
  if (test.kind === "text") {
    const said = test.value.trim();
    const operator = OPERATORS.find((sign) => said.startsWith(sign));
    if (operator !== undefined) {
      const rest = said.slice(operator.length).trim();
      const against: FormulaValue = Number.isNaN(Number(rest)) || rest === "" ? text(rest) : number(Number(rest));
      const order = compare(value, against);
      if (operator === "<=") return order <= 0;
      if (operator === ">=") return order >= 0;
      if (operator === "<>") return order !== 0;
      if (operator === "<") return order < 0;
      if (operator === ">") return order > 0;
      return order === 0;
    }
  }
  return compare(value, test) === 0;
};

export const CALLS: Readonly<Record<string, Call>> = {
  SUM: (values) => number(numbers(values).reduce((total, held) => total + held, 0)),
  MEAN: (values) => statistic(numbers(values), (held) => held.reduce((total, one) => total + one, 0) / held.length),
  AVERAGE: (values) => statistic(numbers(values), (held) => held.reduce((total, one) => total + one, 0) / held.length),
  MEDIAN: (values) => statistic(numbers(values), median),
  MIN: (values) => statistic(numbers(values), (held) => Math.min(...held)),
  MAX: (values) => statistic(numbers(values), (held) => Math.max(...held)),
  PERCENTILE: (values) => {
    arity(values, 2, 2);
    const fraction = numberOf(values[1]);
    if (fraction < 0 || fraction > 1) fail("#NUM!");
    return statistic(numbers([values[0]]), (held) => percentile(held, fraction));
  },
  COUNT: (values) => number(numbers(values).length),
  COUNTA: (values) => number(scalars(values).filter((value) => !isEmpty(value)).length),
  COUNTIF: (values) => {
    arity(values, 2, 2);
    return number(scalars([values[0]]).filter((value) => matches(value, values[1])).length);
  },
  SUMIF: (values) => {
    arity(values, 2, 3);
    const over = scalars([values[0]]);
    const sums = values.length === 3 ? scalars([values[2]]) : over;
    let total = 0;
    over.forEach((value, index) => {
      if (!matches(value, values[1])) return;
      const held = sums[index];
      if (held?.kind === "number") total += held.value;
    });
    return number(total);
  },
  ROUND: (values) => {
    arity(values, 1, 2);
    return number(rounded(numberOf(values[0]), values.length === 2 ? Math.trunc(numberOf(values[1])) : 0));
  },
  ABS: (values) => {
    arity(values, 1, 1);
    return number(Math.abs(numberOf(values[0])));
  },
  SQRT: (values) => {
    arity(values, 1, 1);
    const held = numberOf(values[0]);
    if (held < 0) fail("#NUM!");
    return number(Math.sqrt(held));
  },
  POWER: (values) => {
    arity(values, 2, 2);
    return number(numberOf(values[0]) ** numberOf(values[1]));
  },
  AND: (values) => logic(scalars(values).every((value) => logicOf(value))),
  OR: (values) => logic(scalars(values).some((value) => logicOf(value))),
  NOT: (values) => {
    arity(values, 1, 1);
    return logic(!logicOf(values[0]));
  },
  ISEMPTY: (values) => {
    arity(values, 1, 1);
    return logic(isEmpty(values[0]));
  },
  CONCAT: (values) => text(scalars(values).map((value) => textOf(value)).join("")),
  CONCATENATE: (values) => text(scalars(values).map((value) => textOf(value)).join("")),
  UPPER: (values) => {
    arity(values, 1, 1);
    return text(textOf(values[0]).toUpperCase());
  },
  LOWER: (values) => {
    arity(values, 1, 1);
    return text(textOf(values[0]).toLowerCase());
  },
  TRIM: (values) => {
    arity(values, 1, 1);
    return text(textOf(values[0]).trim());
  },
  LEN: (values) => {
    arity(values, 1, 1);
    return number(textOf(values[0]).length);
  },
  DATE: (values) => {
    arity(values, 3, 3);
    const year = Math.trunc(numberOf(values[0]));
    const month = Math.trunc(numberOf(values[1]));
    const day = Math.trunc(numberOf(values[2]));
    if (month < 1 || month > 12 || day < 1 || day > 31) fail("#NUM!");
    return {
      kind: "date",
      value: {
        calendar: "gregorian",
        year,
        month,
        day,
        utc: daysFromCivil(year, month, day) * 86400000
      }
    };
  },
  YEAR: (values) => {
    arity(values, 1, 1);
    const held = values[0];
    if (held.kind !== "date") fail("#VALUE!");
    return number(held.value.year);
  },
  MONTH: (values) => {
    arity(values, 1, 1);
    const held = values[0];
    if (held.kind !== "date") fail("#VALUE!");
    return number(held.value.month);
  },
  DAY: (values) => {
    arity(values, 1, 1);
    const held = values[0];
    if (held.kind !== "date") fail("#VALUE!");
    return number(held.value.day);
  },
  UNIQUE: (values) => {
    arity(values, 1, 1);
    const seen = new Set<string>();
    const kept: FormulaValue[] = [];
    for (const value of scalars([values[0]])) {
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(value);
    }
    return list(kept);
  }
};

export const LAZY_CALLS: Readonly<Record<string, LazyCall>> = {
  IF: (args, run) => {
    arity(args, 2, 3);
    if (logicOf(run(args[0]))) return run(args[1]);
    return args.length === 3 ? run(args[2]) : logic(false);
  },
  IFERROR: (args, run) => {
    arity(args, 2, 2);
    try {
      return run(args[0]);
    } catch (thrown) {
      if (refusalOf(thrown) === undefined) throw thrown;
      return run(args[1]);
    }
  },
  IFEMPTY: (args, run) => {
    arity(args, 2, 2);
    const held = run(args[0]);
    return isEmpty(held) ? run(args[1]) : held;
  }
};

export const BUILT_IN_NAMES: readonly string[] = [...Object.keys(CALLS), ...Object.keys(LAZY_CALLS)].sort();

export const isBuiltIn = (name: string): boolean => name in CALLS || name in LAZY_CALLS;

/** What an aggregate answers when it is handed nothing at all. */
export const EMPTY_ANSWER: FormulaValue = EMPTY;
