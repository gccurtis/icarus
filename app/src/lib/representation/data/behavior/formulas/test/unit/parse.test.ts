import { describe, expect, it } from "vitest";

import { parseFormula } from "$representation/data/behavior/formulas/parse";
import type { Expression } from "$representation/data/types/formulas/expression";

const tree = (source: string): Expression => {
  const read = parseFormula(source);
  if (!read.ok) throw new Error(`refused with ${read.refusal.token}`);
  return read.expression;
};

const refusal = (source: string): string | undefined => {
  const read = parseFormula(source);
  return read.ok ? undefined : read.refusal.token;
};

describe("reading a formula", () => {
  it("takes a leading equals sign as the sheet's mark, not the language's", () => {
    expect(tree("=1")).toEqual(tree("1"));
  });

  it("reads the four literals", () => {
    expect(tree("1.5")).toEqual({ kind: "literal", value: { kind: "number", value: 1.5 } });
    expect(tree('"a"')).toEqual({ kind: "literal", value: { kind: "text", value: "a" } });
    expect(tree("TRUE")).toEqual({ kind: "literal", value: { kind: "logic", value: true } });
    expect(tree("FALSE")).toEqual({ kind: "literal", value: { kind: "logic", value: false } });
  });

  it("groups by precedence and associates the power to the right", () => {
    expect(tree("1+2*3")).toEqual({
      kind: "binary",
      operator: "+",
      left: { kind: "literal", value: { kind: "number", value: 1 } },
      right: {
        kind: "binary",
        operator: "*",
        left: { kind: "literal", value: { kind: "number", value: 2 } },
        right: { kind: "literal", value: { kind: "number", value: 3 } }
      }
    });
    const power = tree("2^3^2");
    expect(power.kind).toBe("binary");
    if (power.kind === "binary") expect(power.right.kind).toBe("binary");
  });

  it("puts not between and and the comparisons", () => {
    const negated = tree("not a = b");
    expect(negated).toEqual({
      kind: "unary",
      operator: "not",
      of: {
        kind: "binary",
        operator: "=",
        left: { kind: "name", name: "a" },
        right: { kind: "name", name: "b" }
      }
    });
  });

  it("tells a call from a name by the bracket that follows it", () => {
    expect(tree("SUM(1)").kind).toBe("call");
    expect(tree("SUM").kind).toBe("name");
    expect(tree("SUM()")).toEqual({ kind: "call", name: "SUM", arguments: [] });
  });

  it("reads every positional slice the grammar allows", () => {
    expect(tree("t[0]")).toMatchObject({ kind: "index", slice: { kind: "pick", at: 0 } });
    expect(tree("t[-1]")).toMatchObject({ kind: "index", slice: { kind: "pick", at: -1 } });
    expect(tree("t[2:5]")).toMatchObject({ kind: "index", slice: { kind: "span", from: 2, to: 5 } });
    expect(tree("t[:3]")).toMatchObject({ kind: "index", slice: { kind: "span", to: 3 } });
    expect(tree("t[3:]")).toMatchObject({ kind: "index", slice: { kind: "span", from: 3 } });
    expect(tree("t[:]")).toMatchObject({ kind: "index", slice: { kind: "span" } });
    expect(tree("t[-3:]")).toMatchObject({ kind: "index", slice: { kind: "span", from: -3 } });
  });

  it("reads projections and predicates in any order", () => {
    expect(tree("t.{name, minutes}")).toMatchObject({ kind: "query", keep: ["name", "minutes"], where: [] });
    const both = tree("t.{(minutes > 1), name}");
    expect(both).toMatchObject({ kind: "query", keep: ["name"] });
    if (both.kind === "query") expect(both.where).toHaveLength(1);
  });

  it("reads the suffixes and lets them chain", () => {
    expect(tree("x!").kind).toBe("resolve");
    expect(tree("x%").kind).toBe("percent");
    expect(tree("x!.name[0]")).toMatchObject({ kind: "index", of: { kind: "field", of: { kind: "resolve" } } });
  });

  it("reads an address inside backticks and refuses a malformed one", () => {
    expect(tree("`cell|spreadsheets:1|r4|c5`")).toEqual({
      kind: "address",
      address: { at: "cell", resourceId: "spreadsheets:1", cell: { rowId: "r4", columnId: "c5" } }
    });
    expect(refusal("`cell|spreadsheets:1|r4`")).toBe("#REF!");
  });

  it("refuses what it cannot read rather than guessing", () => {
    expect(refusal("1 +")).toBe("#ERROR!");
    expect(refusal("(1")).toBe("#ERROR!");
    expect(refusal("1 2")).toBe("#ERROR!");
    expect(refusal("t.{}")).toBe("#ERROR!");
    expect(refusal("t[1.5]")).toBe("#ERROR!");
    expect(refusal("t.")).toBe("#ERROR!");
    expect(refusal("#")).toBe("#ERROR!");
  });
});
