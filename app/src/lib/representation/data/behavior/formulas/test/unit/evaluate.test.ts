import { describe, expect, it } from "vitest";

import { writeAddress } from "$representation/data/behavior/formulas/addresses";
import { asId } from "$representation/data/behavior/core/id";
import { evaluate } from "$representation/data/behavior/formulas/evaluate";
import { parseFormula } from "$representation/data/behavior/formulas/parse";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Address } from "$representation/data/types/formulas/expression";
import type { Answer } from "$representation/data/types/formulas/refusal";
import type { Resolver } from "$representation/data/types/formulas/resolver";

const number = (value: number): FormulaValue => ({ kind: "number", value });
const text = (value: string): FormulaValue => ({ kind: "text", value });
const logic = (value: boolean): FormulaValue => ({ kind: "logic", value });
const held = (value: FormulaValue): Answer => ({ ok: true, value });

const OUTAGES: FormulaValue = {
  kind: "table",
  columns: [{ name: "name" }, { name: "minutes" }, { name: "tier" }],
  rows: [
    [text("Ashgrove"), number(1610), text("Tier 1")],
    [text("Barrow Hill"), number(412), text("Tier 3")],
    [text("Coldwater"), number(2985), text("Tier 1")],
    [text("Lindow"), number(1204), text("Tier 2")]
  ]
};

const VARIABLES: Readonly<Record<string, FormulaValue>> = {
  outages: OUTAGES,
  rate: number(3.1),
  region: text("North"),
  approved: logic(true),
  tiers: { kind: "list", values: [text("Tier 1"), text("Tier 2"), text("Tier 3")] },
  target: { kind: "record", fields: { minutes: number(15000), cost: number(50000) } },
  nothing: { kind: "table", columns: [{ name: "name" }], rows: [] },
  events: {
    kind: "reference",
    target: {
      to: "resource",
      ref: { kind: "spreadsheet", id: asId<"spreadsheets">("spreadsheets:9") }
    }
  },
  alias: { kind: "reference", target: { to: "variable", name: "rate" } },
  chain: { kind: "reference", target: { to: "variable", name: "alias" } },
  ring: { kind: "reference", target: { to: "variable", name: "loop" } },
  loop: { kind: "reference", target: { to: "variable", name: "ring" } },
  feeder: { kind: "range", resourceId: "spreadsheets:1" as never, from: { rowId: "r4", columnId: "c5" }, to: { rowId: "r6", columnId: "c5" } }
};

const CELLS: Readonly<Record<string, Answer>> = {
  "cell|spreadsheets:1|r4|c5": held(number(60)),
  "cell|spreadsheets:1|r5|c5": held(number(40)),
  "cell|spreadsheets:1|r6|c5": held(number(20)),
  "cell|spreadsheets:1|r9|c2": held(text("Ashgrove")),
  "cell|spreadsheets:1|r9|c3": held({ kind: "empty" }),
  "cell|spreadsheets:1|r7|c1": {
    ok: false,
    refusal: { token: "#DIV/0!", at: { resourceId: "spreadsheets:1" as never, rowId: "r7", columnId: "c1" } }
  },
  "range|spreadsheets:1|r4|c5|r6|c5": held({ kind: "list", values: [number(60), number(40), number(20)] }),
  "resource|spreadsheet|spreadsheets:9": held(OUTAGES)
};

const resolver: Resolver = {
  variable: (name) => (name in VARIABLES ? held(VARIABLES[name]) : null),
  address: (address: Address) => CELLS[writeAddress(address)] ?? null
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

describe("arithmetic and operators", () => {
  it("computes with the precedence a spreadsheet uses", () => {
    expect(value("=1+2*3")).toEqual(number(7));
    expect(value("=(1+2)*3")).toEqual(number(9));
    expect(value("=2^3^2")).toEqual(number(512));
    expect(value("=-2^2")).toEqual(number(4));
    expect(value("=10/4")).toEqual(number(2.5));
    expect(value("=50%")).toEqual(number(0.5));
  });

  it("joins text and compares without case", () => {
    expect(value('="a" & "b"')).toEqual(text("ab"));
    expect(value('="Ashgrove" = "ashgrove"')).toEqual(logic(true));
    expect(value("=3 <> 4")).toEqual(logic(true));
    expect(value("=3 >= 3")).toEqual(logic(true));
  });

  it("reads the word operators the way it reads the symbols", () => {
    expect(value("=TRUE and FALSE")).toEqual(logic(false));
    expect(value("=TRUE or FALSE")).toEqual(logic(true));
    expect(value("=not TRUE")).toEqual(logic(false));
    expect(value("=not 3 = 4")).toEqual(logic(true));
    expect(value("=1 = 1 and 2 = 2")).toEqual(logic(true));
  });

  it("refuses division by zero and unreadable text", () => {
    expect(token("=1/0")).toBe("#DIV/0!");
    expect(token('="apple" * 2')).toBe("#VALUE!");
    expect(token("=1 +")).toBe("#ERROR!");
    expect(token("=")).toBe("#ERROR!");
  });

  it("reads a blank as a zero in arithmetic and as nothing in a count", () => {
    expect(value("=`cell|spreadsheets:1|r9|c3` + 5")).toEqual(number(5));
    expect(value("=COUNT(`cell|spreadsheets:1|r9|c3`)")).toEqual(number(0));
  });
});

describe("names", () => {
  it("answers a project name from the variables the resolver holds", () => {
    expect(value("=rate")).toEqual(number(3.1));
    expect(value("=region")).toEqual(text("North"));
    expect(value("=rate * 2")).toEqual(number(6.2));
  });

  it("names the word it could not place", () => {
    const found = answer("=widgets + 1");
    expect(found.ok).toBe(false);
    if (!found.ok) {
      expect(found.refusal.token).toBe("#NAME?");
      expect(found.refusal.word).toBe("widgets");
    }
  });

  it("refuses a call nothing defines", () => {
    expect(token("=SUMM(1, 2)")).toBe("#NAME?");
  });
});

describe("addresses", () => {
  it("asks the resolver for a cell and a range", () => {
    expect(value("=`cell|spreadsheets:1|r4|c5`")).toEqual(number(60));
    expect(value("=SUM(`range|spreadsheets:1|r4|c5|r6|c5`)")).toEqual(number(120));
  });

  it("refuses an address nothing answers for", () => {
    expect(token("=`cell|spreadsheets:1|r99|c99`")).toBe("#REF!");
  });

  it("carries a refusal out of the cell that raised it, with where it started", () => {
    const found = answer("=`cell|spreadsheets:1|r7|c1` * 2");
    expect(found.ok).toBe(false);
    if (!found.ok) {
      expect(found.refusal.token).toBe("#DIV/0!");
      expect(found.refusal.at).toEqual({ resourceId: "spreadsheets:1", rowId: "r7", columnId: "c1" });
    }
  });

  it("resolves a range a variable holds as soon as it is read", () => {
    expect(value("=SUM(feeder)")).toEqual(number(120));
    expect(value("=COUNT(feeder)")).toEqual(number(3));
  });
});

describe("references", () => {
  it("hands back a pointer rather than following it", () => {
    expect(value("=events")).toEqual(VARIABLES.events);
  });

  it("resolves one when asked", () => {
    expect(value("=events!")).toEqual(OUTAGES);
    expect(value("=alias!")).toEqual(number(3.1));
  });

  it("walks a chain of aliases to the value at the end", () => {
    expect(value("=chain!")).toEqual(number(3.1));
  });

  it("does nothing to something that is not a reference", () => {
    expect(value("=rate!")).toEqual(number(3.1));
    expect(value("=(1 + 2)!")).toEqual(number(3));
  });

  it("refuses a ring rather than walking it forever", () => {
    expect(token("=ring!")).toBe("#CYCLE!");
  });

  it("slices what it resolved", () => {
    expect(value("=events!.minutes[0]")).toEqual(number(1610));
    expect(value("=SUM(events!.minutes)")).toEqual(number(6211));
  });
});

describe("positional slicing", () => {
  it("takes a row, a value and a run the way Python does", () => {
    expect(value("=outages[0].name")).toEqual(text("Ashgrove"));
    expect(value("=outages[-1].name")).toEqual(text("Lindow"));
    expect(value("=outages.minutes[0]")).toEqual(number(1610));
    expect(value("=outages.minutes[-1]")).toEqual(number(1204));
    expect(value("=COUNT(outages[1:3].minutes)")).toEqual(number(2));
    expect(value("=COUNT(outages[:2].minutes)")).toEqual(number(2));
    expect(value("=COUNT(outages[2:].minutes)")).toEqual(number(2));
    expect(value("=COUNT(outages[:].minutes)")).toEqual(number(4));
    expect(value("=COUNT(outages[-2:].minutes)")).toEqual(number(2));
  });

  it("composes left to right", () => {
    expect(value("=outages[0][1]")).toEqual(number(1610));
    expect(value("=outages[0:2][1].name")).toEqual(text("Barrow Hill"));
  });

  it("refuses a position past the end of something that has rows", () => {
    expect(token("=outages[99]")).toBe("#INDEX!");
    expect(token("=outages[-99]")).toBe("#INDEX!");
  });

  it("answers empty when there was nothing to index", () => {
    expect(value("=nothing[0]")).toEqual({ kind: "empty" });
    expect(value("=nothing[-1]")).toEqual({ kind: "empty" });
    expect(value("=nothing[0].name")).toEqual({ kind: "empty" });
  });

  it("refuses to index a shape that has no rows at all", () => {
    expect(token("=rate[0]")).toBe("#SHAPE!");
  });
});

describe("semantic slicing", () => {
  it("keeps the fields a bare name asks for", () => {
    expect(value("=COUNT(outages.{name}.name)")).toEqual(number(0));
    expect(value("=outages.{name}[0].name")).toEqual(text("Ashgrove"));
  });

  it("keeps the rows a predicate holds for", () => {
    expect(value("=COUNT(outages.{(minutes > 1000)}.minutes)")).toEqual(number(3));
    expect(value("=SUM(outages.{(tier = \"Tier 1\")}.minutes)")).toEqual(number(4595));
  });

  it("filters before it projects, so a predicate may name a dropped field", () => {
    expect(value('=outages.{name, (tier = "Tier 1")}[1].name')).toEqual(text("Coldwater"));
  });

  it("reads and, or and not inside a predicate", () => {
    expect(value('=COUNT(outages.{(tier = "Tier 1" and minutes > 2000)}.minutes)')).toEqual(number(1));
    expect(value('=COUNT(outages.{(tier = "Tier 3" or tier = "Tier 2")}.minutes)')).toEqual(number(2));
    expect(value('=COUNT(outages.{(not (tier = "Tier 1"))}.minutes)')).toEqual(number(2));
  });

  it("lets a predicate name the whole table as well as the row", () => {
    expect(value("=COUNT(outages.{(minutes > MEAN(outages.minutes))}.minutes)")).toEqual(number(2));
  });

  it("refuses a field the table does not have", () => {
    expect(token("=outages.custmers")).toBe("#FIELD?");
    expect(token("=outages.{custmers}")).toBe("#FIELD?");
  });

  it("refuses a query on a shape that has no fields", () => {
    expect(token("=tiers.{name}")).toBe("#SHAPE!");
    expect(token("=rate.name")).toBe("#SHAPE!");
  });

  it("answers an empty table when nothing survives", () => {
    expect(value("=outages.{(minutes > 99999)}[0]")).toEqual({ kind: "empty" });
    expect(value("=SUM(outages.{(minutes > 99999)}.minutes)")).toEqual(number(0));
    expect(value("=COUNT(outages.{(minutes > 99999)}.minutes)")).toEqual(number(0));
  });
});

describe("emptiness", () => {
  it("asks whether anything survived", () => {
    expect(value("=ISEMPTY(nothing)")).toEqual(logic(true));
    expect(value("=ISEMPTY(outages)")).toEqual(logic(false));
    expect(value('=ISEMPTY(outages.{(minutes > 99999)})')).toEqual(logic(true));
  });

  it("sums and counts nothing as zero rather than refusing", () => {
    expect(value("=SUM(nothing)")).toEqual(number(0));
    expect(value("=COUNT(nothing)")).toEqual(number(0));
  });

  it("refuses a statistic asked of nothing", () => {
    expect(token("=MEAN(nothing)")).toBe("#N/A");
    expect(token("=MEDIAN(nothing)")).toBe("#N/A");
    expect(token("=MIN(nothing)")).toBe("#N/A");
  });
});

describe("records and lists", () => {
  it("dots a record and indexes a list", () => {
    expect(value("=target.minutes")).toEqual(number(15000));
    expect(value("=tiers[1]")).toEqual(text("Tier 2"));
    expect(value("=COUNT(tiers)")).toEqual(number(0));
    expect(value("=COUNTA(tiers)")).toEqual(number(3));
  });

  it("takes a run of a record's fields", () => {
    expect(value("=target[0:1].minutes")).toEqual(number(15000));
  });

  it("refuses a field a record does not have", () => {
    expect(token("=target.margin")).toBe("#FIELD?");
  });
});
