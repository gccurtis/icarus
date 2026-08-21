import { describe, expect, it } from "vitest";

import {
  addAxisLine,
  addCagrLine,
  capabilitiesFor,
  cagrForLine,
  chartIssues,
  createBarChart,
  createPieChart,
  reconcileChartData,
  removeChartElements,
  setChartDatumStyle,
  type ChartDataInput,
  type ChartIdIssuer
} from "$lib/unique-components/chart";

const data: ChartDataInput = {
  categories: [
    { id: "category-2022", key: "2022", label: "2022" },
    { id: "category-2023", key: "2023", label: "2023" },
    { id: "category-2024", key: "2024", label: "2024" }
  ],
  series: [{ id: "series-revenue", key: "revenue", label: "Revenue" }],
  values: [
    { id: "datum-2022", categoryKey: "2022", seriesKey: "revenue", value: 100 },
    { id: "datum-2023", categoryKey: "2023", seriesKey: "revenue", value: 121 },
    { id: "datum-2024", categoryKey: "2024", seriesKey: "revenue", value: 144 }
  ]
};

const deterministic = (): ChartIdIssuer => {
  let next = 0;
  return (kind) => `${kind}-${++next}`;
};

describe("chart model", () => {
  it("issues ids for the chart and axes while preserving source ids", () => {
    const chart = createBarChart({ data }, deterministic());
    expect(chart.id).toBe("chart-1");
    expect(chart.axes.category.id).toBe("axis-2");
    expect(chart.axes.value.id).toBe("axis-3");
    expect(chart.data.datums.map((datum) => datum.id)).toEqual([
      "datum-2022",
      "datum-2023",
      "datum-2024"
    ]);
    expect(chartIssues(chart)).toEqual([]);
  });

  it("keeps the type capability boundary explicit", () => {
    expect(capabilitiesFor("bar").addableElements).toEqual([
      "cagr-line",
      "axis-line",
      "text"
    ]);
    expect(capabilitiesFor("pie")).toMatchObject({
      axes: false,
      selectableMark: "slice",
      legendDimension: "category",
      addableElements: ["text"]
    });
  });

  it("refreshes values without re-identifying matching source keys", () => {
    const chart = setChartDatumStyle(
      createBarChart({ data }, deterministic()),
      ["datum-2022"],
      { color: "var(--token-color-accent-1-fill)", opacity: 0.7 }
    );
    const refreshed = reconcileChartData(
      chart.data,
      {
        categories: [...data.categories].reverse().map(({ key, label }) => ({ key, label })),
        series: data.series.map(({ key, label }) => ({ key, label })),
        values: data.values.map(({ categoryKey, seriesKey, value }) => ({
          categoryKey,
          seriesKey,
          value: value + 1
        }))
      },
      deterministic()
    );
    expect(refreshed.categories.find((entry) => entry.key === "2022")?.id).toBe("category-2022");
    expect(refreshed.datums.find((entry) => entry.categoryId === "category-2022")?.id).toBe("datum-2022");
    expect(refreshed.datums.find((entry) => entry.id === "datum-2022")?.style).toEqual({
      color: "var(--token-color-accent-1-fill)",
      opacity: 0.7
    });
  });

  it("styles selected datums without changing their ids or values", () => {
    const chart = createBarChart({ data }, deterministic());
    const styled = setChartDatumStyle(chart, ["datum-2023"], {
      color: "var(--token-color-accent-2-fill)",
      opacity: 0.5
    });
    expect(styled.data.datums.find((entry) => entry.id === "datum-2023")).toMatchObject({
      id: "datum-2023",
      value: 121,
      style: { color: "var(--token-color-accent-2-fill)", opacity: 0.5 }
    });
    expect(() => setChartDatumStyle(chart, ["missing"], { opacity: 0.5 })).toThrow(/does not exist/);
  });

  it("derives CAGR from current endpoint values instead of storing it", () => {
    const chart = createBarChart({ data }, deterministic());
    const withLine = addCagrLine(
      chart,
      {
        seriesId: "series-revenue",
        fromCategoryId: "category-2022",
        toCategoryId: "category-2024",
        periods: 2,
        showRate: true
      },
      deterministic()
    );
    const line = withLine.elements[0];
    expect(line.kind).toBe("cagr-line");
    if (line.kind !== "cagr-line") throw new Error("expected a CAGR line");
    expect(cagrForLine(withLine, line)).toBeCloseTo(0.2);
    expect(line).not.toHaveProperty("rate");
    expect(removeChartElements(withLine, [line.id]).elements).toEqual([]);
  });

  it("refuses axes and CAGR on a pie structurally and at the mutation door", () => {
    const pie = createPieChart({ data }, deterministic());
    expect(() =>
      addCagrLine(pie, {
        seriesId: "series-revenue",
        fromCategoryId: "category-2022",
        toCategoryId: "category-2024",
        periods: 2,
        showRate: true
      })
    ).toThrow(/bar, line, or area charts/);
    expect(() =>
      addAxisLine(pie, {
        axisId: "not-an-axis",
        position: { kind: "value", value: 10 }
      })
    ).toThrow(/cannot be added/);
  });

  it("requires exactly one pie series", () => {
    expect(() =>
      createPieChart(
        {
          data: {
            ...data,
            series: [
              ...data.series,
              { id: "series-cost", key: "cost", label: "Cost" }
            ]
          }
        },
        deterministic()
      )
    ).toThrow(/exactly one series/);
  });

  it("rejects duplicate source pairs before a renderer can pick one arbitrarily", () => {
    expect(() =>
      createBarChart(
        { data: { ...data, values: [...data.values, { ...data.values[0], id: "duplicate" }] } },
        deterministic()
      )
    ).toThrow(/category\/series value/);
  });
});
