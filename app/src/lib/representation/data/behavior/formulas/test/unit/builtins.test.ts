import { describe, expect, it } from "vitest";

import { BUILT_IN_NAMES, CALLS, LAZY_CALLS, isBuiltIn } from "$representation/data/behavior/formulas/builtins";
import { evaluate } from "$representation/data/behavior/formulas/evaluate";
import { parseFormula } from "$representation/data/behavior/formulas/parse";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Answer } from "$representation/data/types/formulas/refusal";
import type { Resolver } from "$representation/data/types/formulas/resolver";

const number = (value: number): FormulaValue => ({ kind: "number", value });
const text = (value: string): FormulaValue => ({ kind: "text", value });

const VARIABLES: Readonly<Record<string, FormulaValue>> = {
  amounts: { kind: "list", values: [number(10), number(20), number(30), number(40)] },
  words: { kind: "list", values: [text("a"), text("b"), text("a"), { kind: "empty" }] },
  mixed: { kind: "list", values: [number(5), text("x"), { kind: "empty" }, number(15)] },
  tiers: { kind: "list", values: [text("Tier 1"), text("Tier 3"), text("Tier 1")] },
  costs: { kind: "list", values: [number(100), number(200), number(300)] }
};

const resolver: Resolver = {
  variable: (name) => (name in VARIABLES ? ({ ok: true, value: VARIABLES[name] } as Answer) : null),
  address: () => null
};

const answer = (source: string): Answer => {
  const read = parseFormula(source);
  if (!read.ok) return { ok: false, refusal: read.refusal };
  return evaluate(read.expression, resolver);
};

const value = (source: string): FormulaValue => {
  const found = answer(source);
  if (!found.ok) throw new Error(`refused with ${found.refusal.token}`);
  return found.value;
};

const token = (source: string): string | undefined => {
  const found = answer(source);
  return found.ok ? undefined : found.refusal.token;
};

describe("the built-in table", () => {
  it("declares every name once, in one place", () => {
    expect(new Set(BUILT_IN_NAMES).size).toBe(BUILT_IN_NAMES.length);
    expect(BUILT_IN_NAMES).toEqual([...BUILT_IN_NAMES].sort());
    for (const name of Object.keys(CALLS)) expect(isBuiltIn(name)).toBe(true);
    for (const name of Object.keys(LAZY_CALLS)) expect(isBuiltIn(name)).toBe(true);
    expect(isBuiltIn("NOPE")).toBe(false);
  });

  it("has no name in both the eager and the lazy table", () => {
    for (const name of Object.keys(LAZY_CALLS)) expect(name in CALLS).toBe(false);
  });
});

describe("maths and statistics", () => {
  it("adds, rounds and powers", () => {
    expect(value("=SUM(amounts)")).toEqual(number(100));
    expect(value("=SUM(1, 2, amounts)")).toEqual(number(103));
    expect(value("=ROUND(2.345, 2)")).toEqual(number(2.35));
    expect(value("=ROUND(-2.5)")).toEqual(number(-3));
    expect(value("=ABS(0-4)")).toEqual(number(4));
    expect(value("=SQRT(9)")).toEqual(number(3));
    expect(value("=POWER(2, 10)")).toEqual(number(1024));
  });

  it("averages, orders and takes a percentile", () => {
    expect(value("=MEAN(amounts)")).toEqual(number(25));
    expect(value("=MEDIAN(amounts)")).toEqual(number(25));
    expect(value("=MIN(amounts)")).toEqual(number(10));
    expect(value("=MAX(amounts)")).toEqual(number(40));
    expect(value("=PERCENTILE(amounts, 0.5)")).toEqual(number(25));
    expect(value("=PERCENTILE(amounts, 0)")).toEqual(number(10));
    expect(value("=PERCENTILE(amounts, 1)")).toEqual(number(40));
  });

  it("skips text and blanks rather than coercing them", () => {
    expect(value("=SUM(mixed)")).toEqual(number(20));
    expect(value("=COUNT(mixed)")).toEqual(number(2));
    expect(value("=COUNTA(mixed)")).toEqual(number(3));
  });

  it("refuses an impossible number and a fraction out of range", () => {
    expect(token("=SQRT(0-1)")).toBe("#NUM!");
    expect(token("=PERCENTILE(amounts, 2)")).toBe("#NUM!");
  });

  it("counts and sums what matches a criterion", () => {
    expect(value('=COUNTIF(tiers, "Tier 1")')).toEqual(number(2));
    expect(value('=COUNTIF(amounts, ">20")')).toEqual(number(2));
    expect(value('=COUNTIF(amounts, "<>10")')).toEqual(number(3));
    expect(value('=SUMIF(tiers, "Tier 1", costs)')).toEqual(number(400));
    expect(value('=SUMIF(amounts, ">=30")')).toEqual(number(70));
  });
});

describe("logic", () => {
  it("reads every value it is given", () => {
    expect(value("=AND(TRUE, TRUE)")).toEqual({ kind: "logic", value: true });
    expect(value("=AND(TRUE, FALSE)")).toEqual({ kind: "logic", value: false });
    expect(value("=OR(FALSE, TRUE)")).toEqual({ kind: "logic", value: true });
    expect(value("=NOT(FALSE)")).toEqual({ kind: "logic", value: true });
  });

  it("evaluates only the branch a test takes", () => {
    expect(value("=IF(TRUE, 1, 1/0)")).toEqual(number(1));
    expect(value("=IF(FALSE, 1/0, 2)")).toEqual(number(2));
    expect(value("=IF(FALSE, 1)")).toEqual({ kind: "logic", value: false });
  });

  it("catches a refusal and answers with the other side", () => {
    expect(value("=IFERROR(1/0, 99)")).toEqual(number(99));
    expect(value("=IFERROR(2+2, 99)")).toEqual(number(4));
    expect(value("=IFERROR(widgets, 0)")).toEqual(number(0));
  });

  it("answers around an empty result without wrapping every query", () => {
    expect(value("=IFEMPTY(amounts, 0)")).toEqual(VARIABLES.amounts);
    expect(value('=IFEMPTY(UNIQUE(amounts)[9999:], "none")')).toEqual(text("none"));
  });
});

describe("text", () => {
  it("joins, cases, trims and measures", () => {
    expect(value('=CONCAT("a", "b", 1)')).toEqual(text("ab1"));
    expect(value('=UPPER("ab")')).toEqual(text("AB"));
    expect(value('=LOWER("AB")')).toEqual(text("ab"));
    expect(value('=TRIM("  a  ")')).toEqual(text("a"));
    expect(value('=LEN("abc")')).toEqual(number(3));
  });
});

describe("dates", () => {
  it("builds one from parts, without asking a clock", () => {
    expect(value("=DATE(2026, 9, 7)")).toEqual({
      kind: "date",
      value: { calendar: "gregorian", year: 2026, month: 9, day: 7, utc: 1788739200000 }
    });
    expect(value("=DATE(1970, 1, 1)")).toMatchObject({ value: { utc: 0 } });
    expect(value("=DATE(1969, 12, 31)")).toMatchObject({ value: { utc: -86400000 } });
    expect(value("=DATE(2000, 2, 29)")).toMatchObject({ value: { utc: 951782400000 } });
  });

  it("answers for the parts and compares by the instant", () => {
    expect(value("=YEAR(DATE(2026, 9, 7))")).toEqual(number(2026));
    expect(value("=MONTH(DATE(2026, 9, 7))")).toEqual(number(9));
    expect(value("=DAY(DATE(2026, 9, 7))")).toEqual(number(7));
    expect(value("=DATE(2026, 9, 7) > DATE(2026, 1, 1)")).toEqual({ kind: "logic", value: true });
    expect(value("=DATE(2026, 9, 7) = DATE(2026, 9, 7)")).toEqual({ kind: "logic", value: true });
  });

  it("refuses a month that is not one and a part asked of something else", () => {
    expect(token("=DATE(2026, 13, 1)")).toBe("#NUM!");
    expect(token("=YEAR(3)")).toBe("#VALUE!");
  });
});

describe("lists", () => {
  it("keeps the first of each value and drops the rest", () => {
    expect(value("=UNIQUE(words)")).toEqual({
      kind: "list",
      values: [text("a"), text("b"), { kind: "empty" }]
    });
    expect(value("=COUNT(UNIQUE(amounts))")).toEqual(number(4));
  });
});

describe("arity", () => {
  it("refuses a call given the wrong number of arguments", () => {
    expect(token("=ABS(1, 2)")).toBe("#VALUE!");
    expect(token("=ROUND()")).toBe("#VALUE!");
    expect(token("=IF(TRUE)")).toBe("#VALUE!");
    expect(token("=IFERROR(1)")).toBe("#VALUE!");
  });
});
