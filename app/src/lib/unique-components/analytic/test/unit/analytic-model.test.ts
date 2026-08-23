import { describe, expect, it } from "vitest";

import { asId } from "$json-store/types/core/id";
import type { FormulaValue } from "$json-store/types/content/formula-value";
import type { AnalyticModel } from "$json-store/types/data/analytic";
import {
  analyticIssues,
  compileAnalyticFormula,
  customizationSlotsFor,
  listRequirementFor,
  normalizeAnalyticValue
} from "$lib/unique-components/analytic/analytic-model";
import {
  createBarChart,
  reconcileChartData,
  type ChartDataInput,
  type ChartIdIssuer
} from "$lib/unique-components/chart/chart-model";

const deterministic = (): ChartIdIssuer => {
  let next = 0;
  return (kind) => `${kind}-${++next}`;
};

const chartData: ChartDataInput = {
  categories: [{ id: "category-east", key: "east", label: "East" }],
  series: [{ id: "series-revenue", key: "revenue", label: "Revenue" }],
  values: [{
    id: "datum-east-revenue",
    categoryKey: "east",
    seriesKey: "revenue",
    value: 10,
    label: "Priority market"
  }]
};

const analytic = (): AnalyticModel => ({
  id: "analytic-revenue",
  title: "Revenue by region",
  definition: {
    inputs: [
      { id: "orders", variable: "Orders" },
      { id: "regions", variable: "Regions" }
    ],
    dimensions: [
      {
        id: "x-region",
        slot: "x",
        inputs: [{
          id: "x-orders",
          inputId: "orders",
          values: { kind: "column", key: "regionId" }
        }],
        steps: [],
        operations: []
      },
      {
        id: "y-region",
        slot: "y",
        inputs: [{
          id: "y-regions",
          inputId: "regions",
          values: { kind: "column", key: "name" }
        }],
        steps: [],
        operations: []
      }
    ],
    bridges: [],
    data: {
      from: { kind: "dimension", dimensionId: "x-region" },
      operations: [{
        id: "sum-revenue",
        kind: "aggregate",
        input: {
          kind: "list",
          list: { inputId: "orders", selector: { kind: "column", key: "revenue" } }
        },
        aggregation: "sum",
        as: "Revenue"
      }],
      outputs: [{
        id: "revenue-output",
        label: "Revenue",
        value: { kind: "operation", operationId: "sum-revenue" }
      }]
    }
  },
  component: {
    kind: "chart",
    chart: createBarChart({ id: "chart-revenue", data: chartData }, deterministic())
  },
  materialization: { state: "ready", issueIds: [] }
});

describe("analytic customization contract", () => {
  it("exposes only meaningful slots for each visual grammar", () => {
    expect(customizationSlotsFor("pie").map((entry) => entry.slot)).toEqual(["data", "labels"]);
    expect(customizationSlotsFor("table").map((entry) => entry.slot)).toEqual(["data"]);
    expect(customizationSlotsFor("bubble").map((entry) => entry.slot)).toEqual([
      "x",
      "y",
      "data",
      "size",
      "labels"
    ]);
  });

  it("defaults bars to stacked and retains a custom label through refresh", () => {
    const chart = createBarChart({ data: chartData }, deterministic());
    expect(chart.layout).toBe("stack");
    const refreshed = reconcileChartData(
      chart.data,
      {
        ...chartData,
        values: chartData.values.map((entry) => ({ ...entry, value: 12, label: "Updated label" }))
      },
      deterministic()
    );
    expect(refreshed.datums[0]).toMatchObject({
      id: "datum-east-revenue",
      value: 12,
      label: "Updated label"
    });
  });
});

describe("analytic table algebra", () => {
  it("normalizes scalars, lists, records, and tables into one relation shape", () => {
    expect(normalizeAnalyticValue("scalar", { kind: "number", value: 7 })).toMatchObject({
      columns: [{ key: "value", label: "Value" }],
      rows: [{ id: "scalar:row:0", values: { value: { kind: "number", value: 7 } } }]
    });
    expect(normalizeAnalyticValue("list", {
      kind: "list",
      values: [{ kind: "text", value: "A" }, { kind: "text", value: "B" }]
    }).rows).toHaveLength(2);
    expect(normalizeAnalyticValue("record", {
      kind: "record",
      fields: { name: { kind: "text", value: "A" }, value: { kind: "number", value: 1 } }
    }).columns.map((entry) => entry.key)).toEqual(["name", "value"]);
    expect(normalizeAnalyticValue("table", {
      kind: "table",
      columns: [{ name: "Value" }, { name: "Value" }],
      rows: [[{ kind: "number", value: 1 }, { kind: "number", value: 2 }]]
    }).columns.map((entry) => entry.key)).toEqual(["Value", "Value-2"]);
  });

  it("uses one compact warning and one detailed recovery contract for table-to-list selection", () => {
    const result = listRequirementFor({ kind: "record", fields: {} });
    expect(result).toMatchObject({
      state: "needs-list",
      message: "Needs a list, not a table",
      choices: ["column", "row", "function"]
    });
    if (result.state !== "needs-list") throw new Error("expected a list requirement");
    expect(result.detail).toMatch(/body column or data row/);
  });

  it("requires ranges and functions to resolve before normalization", () => {
    const range: FormulaValue = {
      kind: "range",
      resourceId: asId<"spreadsheets">("sheet-1"),
      from: { rowId: "r1", columnId: "c1" },
      to: { rowId: "r2", columnId: "c2" }
    };
    expect(() => normalizeAnalyticValue("range", range)).toThrow(/resolved/);
    expect(() => normalizeAnalyticValue("function", {
      kind: "function",
      parameters: ["table"],
      formulaId: asId<"formulas">("formula-1")
    })).toThrow(/applied/);
  });
});

describe("analytic relation planning", () => {
  it("reports a disconnected dimension until a bridge becomes the data relation", () => {
    const model = analytic();
    expect(analyticIssues(model).some((entry) => entry.code === "missing-bridge")).toBe(true);

    model.definition.bridges.push({
      id: "bridge-regions",
      kind: "join",
      left: { kind: "dimension", dimensionId: "x-region" },
      right: { kind: "dimension", dimensionId: "y-region" },
      leftKey: { inputId: "orders", selector: { kind: "column", key: "regionId" } },
      rightKey: { inputId: "regions", selector: { kind: "column", key: "id" } },
      join: "outer"
    });
    model.definition.data.from = { kind: "bridge", bridgeId: "bridge-regions" };

    expect(analyticIssues(model).filter((entry) => entry.code === "missing-bridge")).toEqual([]);
  });

  it("requires every dimension input after the first to have one ordered composition step", () => {
    const model = analytic();
    const x = model.definition.dimensions[0];
    x.inputs.push({
      id: "x-regions",
      inputId: "regions",
      values: { kind: "column", key: "name" }
    });
    expect(analyticIssues(model).some((entry) =>
      entry.code === "invalid-order" && entry.path.endsWith("steps")
    )).toBe(true);

    x.steps.push({ id: "extend-regions", kind: "extend", rightBindingId: "x-regions" });
    expect(analyticIssues(model).some((entry) =>
      entry.code === "invalid-order" && entry.path.endsWith("steps")
    )).toBe(false);
  });

  it("rejects references to operations that have not executed yet", () => {
    const model = analytic();
    model.definition.data.operations = [
      {
        id: "sort-before-sum",
        kind: "sort",
        by: { kind: "operation", operationId: "sum-later" },
        direction: "desc"
      },
      {
        id: "sum-later",
        kind: "aggregate",
        input: {
          kind: "list",
          list: { inputId: "orders", selector: { kind: "column", key: "revenue" } }
        },
        aggregation: "sum",
        as: "Revenue"
      }
    ];
    expect(analyticIssues(model).some((entry) =>
      entry.code === "invalid-order" && entry.message.includes("must appear above")
    )).toBe(true);
  });

  it("compiles operations in their visible top-to-bottom order", () => {
    const model = analytic();
    model.definition.data.operations = [
      { id: "filter-active", kind: "filter", predicate: { kind: "formula", formulaId: asId<"formulas">("active") } },
      {
        id: "sort-revenue",
        kind: "sort",
        by: {
          kind: "list",
          list: { inputId: "orders", selector: { kind: "column", key: "revenue" } }
        },
        direction: "desc"
      },
      { id: "top-three", kind: "limit", count: 3 }
    ];
    model.definition.data.outputs = [{
      id: "top-output",
      label: "Top revenue",
      value: { kind: "operation", operationId: "top-three" }
    }];
    const compiled = compileAnalyticFormula(model);
    expect(compiled.indexOf("FILTER(")).toBeLessThan(compiled.indexOf("SORT("));
    expect(compiled.indexOf("SORT(")).toBeLessThan(compiled.indexOf("LIMIT("));
    expect(compiled).toContain("SORT($filter-active");
    expect(compiled).toContain("LIMIT($sort-revenue");
  });

  it("validates stable identities in a materialized table", () => {
    const model = analytic();
    model.definition.dimensions = [];
    model.definition.bridges = [];
    model.definition.data.from = { kind: "input", inputId: "orders" };
    model.component = {
      kind: "table",
      table: {
        id: "table-1",
        columns: [{ id: "column-1", key: "region", label: "Region" }],
        rows: [{
          id: "row-1",
          key: "east",
          cells: [
            { id: "cell-1", columnId: "column-1", value: { kind: "text", value: "East" } },
            { id: "cell-1", columnId: "missing", value: { kind: "number", value: 10 } }
          ]
        }]
      }
    };
    const issues = analyticIssues(model);
    expect(issues.some((entry) => entry.code === "duplicate-id")).toBe(true);
    expect(issues.some((entry) => entry.code === "missing-reference" && entry.path.endsWith("columnId"))).toBe(true);
  });
});
