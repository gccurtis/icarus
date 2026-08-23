import { describe, expect, it } from "vitest";

import { createBarChart, createPieChart, type ChartIdIssuer } from "$lib/unique-components/chart";
import { layoutBars, layoutPie } from "$lib/unique-components/chart/plot";

const issuer: ChartIdIssuer = (() => {
  let next = 0;
  return (kind) => `${kind}-${++next}`;
})();

const source = {
  categories: [
    { id: "category-a", key: "a", label: "A" },
    { id: "category-b", key: "b", label: "B" }
  ],
  series: [
    { id: "series-one", key: "one", label: "One" },
    { id: "series-two", key: "two", label: "Two" }
  ],
  values: [
    { id: "datum-a-one", categoryKey: "a", seriesKey: "one", value: 10 },
    { id: "datum-a-two", categoryKey: "a", seriesKey: "two", value: 5 },
    { id: "datum-b-one", categoryKey: "b", seriesKey: "one", value: 20 },
    { id: "datum-b-two", categoryKey: "b", seriesKey: "two", value: 7 }
  ]
} as const;

describe("native chart layout", () => {
  it("passes datum ids through to marks and does not derive identity from order", () => {
    const chart = createBarChart({ data: source, layout: "group" }, issuer);
    const size = { width: 600, height: 300, pad: { top: 20, right: 20, bottom: 40, left: 50 } };
    const first = layoutBars(chart, size);
    const reordered = layoutBars(
      { ...chart, data: { ...chart.data, categories: [...chart.data.categories].reverse() } },
      size
    );
    expect(new Set(first.marks.map((mark) => mark.id))).toEqual(
      new Set(reordered.marks.map((mark) => mark.id))
    );
    expect(first.marks.find((mark) => mark.id === "datum-a-one")?.categoryId).toBe("category-a");
  });

  it("lays negative bars on the other side of zero", () => {
    const chart = createBarChart(
      {
        data: {
          categories: source.categories,
          series: [source.series[0]],
          values: [
            source.values[0],
            { ...source.values[2], value: -20 }
          ]
        },
        layout: "group"
      },
      issuer
    );
    const result = layoutBars(chart, {
      width: 600,
      height: 300,
      pad: { top: 20, right: 20, bottom: 40, left: 50 }
    });
    const positive = result.marks.find((mark) => mark.value > 0)!;
    const negative = result.marks.find((mark) => mark.value < 0)!;
    expect(positive.box.y).toBeLessThan(negative.box.y);
    expect(result.domain[0]).toBeLessThan(0);
    expect(result.domain[1]).toBeGreaterThan(0);
  });

  it("draws a one-slice doughnut as a non-empty closed path", () => {
    const chart = createPieChart(
      {
        data: {
          categories: [source.categories[0]],
          series: [source.series[0]],
          values: [source.values[0]]
        },
        innerRadius: 0.35
      },
      issuer
    );
    const result = layoutPie(chart, { width: 400, height: 300 });
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].path).toContain("A");
    expect(result.slices[0].path.endsWith("Z")).toBe(true);
  });
});
