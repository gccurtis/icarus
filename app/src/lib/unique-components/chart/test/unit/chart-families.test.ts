import { describe, expect, it } from "vitest";

import {
  addTrendLine,
  capabilitiesFor,
  chartIssues,
  createAreaChart,
  createBubbleChart,
  createFunnelChart,
  createHeatmapChart,
  createLineChart,
  createMekkoChart,
  createRadarChart,
  createScatterChart,
  createTreemapChart,
  createWaterfallChart,
  trendForLine,
  type ChartDataInput,
  type ChartIdIssuer,
  type ChartModel
} from "$lib/unique-components/chart";

const issuer = (): ChartIdIssuer => {
  let next = 0;
  return (kind) => `${kind}-${++next}`;
};

const categoryData: ChartDataInput = {
  categories: [
    { id: "category-a", key: "a", label: "A" },
    { id: "category-b", key: "b", label: "B" },
    { id: "category-c", key: "c", label: "C" }
  ],
  series: [
    { id: "series-one", key: "one", label: "One" },
    { id: "series-two", key: "two", label: "Two" }
  ],
  values: [
    { id: "datum-a-one", categoryKey: "a", seriesKey: "one", value: 10, x: 1, size: 4 },
    { id: "datum-b-one", categoryKey: "b", seriesKey: "one", value: 20, x: 2, size: 9 },
    { id: "datum-c-one", categoryKey: "c", seriesKey: "one", value: 35, x: 4, size: 16 },
    { id: "datum-a-two", categoryKey: "a", seriesKey: "two", value: 8, x: 1.5, size: 6 },
    { id: "datum-b-two", categoryKey: "b", seriesKey: "two", value: 16, x: 3, size: 12 },
    { id: "datum-c-two", categoryKey: "c", seriesKey: "two", value: 28, x: 5, size: 20 }
  ]
};

const singleSeriesData: ChartDataInput = {
  categories: categoryData.categories,
  series: [categoryData.series[0]],
  values: categoryData.values.filter((entry) => entry.seriesKey === "one")
};

describe("expanded chart families", () => {
  it("constructs every added type as a valid member of the same model union", () => {
    const charts: ChartModel[] = [
      createLineChart({ data: categoryData }, issuer()),
      createAreaChart({ data: categoryData, layout: "stack" }, issuer()),
      createScatterChart({ data: categoryData }, issuer()),
      createBubbleChart({ data: categoryData }, issuer()),
      createWaterfallChart(
        { data: singleSeriesData, totals: ["category-a", "category-c"] },
        issuer()
      ),
      createMekkoChart({ data: categoryData }, issuer()),
      createFunnelChart({ data: singleSeriesData }, issuer()),
      createRadarChart({ data: categoryData }, issuer()),
      createHeatmapChart({ data: categoryData }, issuer()),
      createTreemapChart({ data: singleSeriesData }, issuer())
    ];

    expect(charts.map((chart) => chart.type)).toEqual([
      "line",
      "area",
      "scatter",
      "bubble",
      "waterfall",
      "mekko",
      "funnel",
      "radar",
      "heatmap",
      "treemap"
    ]);
    expect(charts.flatMap(chartIssues)).toEqual([]);
  });

  it("states chart-specific interactions in one exhaustive capability matrix", () => {
    expect(capabilitiesFor("mekko")).toMatchObject({
      axes: true,
      selectableMark: "segment",
      legendDimension: "series",
      addableElements: ["axis-line", "text"]
    });
    expect(capabilitiesFor("scatter").addableElements).toContain("trend-line");
    expect(capabilitiesFor("funnel").addableElements).toEqual(["text"]);
    expect(capabilitiesFor("heatmap").legendDimension).toBe("none");
  });

  it("derives a point-chart regression and persists only its declaration", () => {
    const scatter = createScatterChart({ data: categoryData }, issuer());
    const withTrend = addTrendLine(
      scatter,
      {
        seriesId: "series-one",
        showEquation: true,
        showRSquared: true
      },
      issuer()
    );
    const line = withTrend.elements[0];
    expect(line.kind).toBe("trend-line");
    if (line.kind !== "trend-line") throw new Error("expected trend line");
    expect(line).not.toHaveProperty("slope");
    expect(trendForLine(withTrend, line)?.slope).toBeGreaterThan(0);
  });

  it("requires the channels used by scatter and bubble encodings", () => {
    const withoutPointChannels: ChartDataInput = {
      ...singleSeriesData,
      values: singleSeriesData.values.map(({ id, categoryKey, seriesKey, value }) => ({
        id,
        categoryKey,
        seriesKey,
        value
      }))
    };
    expect(() => createScatterChart({ data: withoutPointChannels }, issuer())).toThrow(
      /require an x channel/
    );
    expect(() => createBubbleChart({ data: withoutPointChannels }, issuer())).toThrow(
      /require x and non-negative size/
    );
  });

  it("keeps Mekko width semantics explicit and identified", () => {
    const mekko = createMekkoChart(
      {
        data: categoryData,
        widths: {
          kind: "custom",
          weights: [
            { categoryId: "category-a", value: 20 },
            { categoryId: "category-b", value: 30 },
            { categoryId: "category-c", value: 50 }
          ]
        }
      },
      issuer()
    );
    expect(mekko.widths.kind).toBe("custom");
    expect(chartIssues(mekko)).toEqual([]);
    expect(() =>
      createMekkoChart(
        {
          data: categoryData,
          widths: { kind: "custom", weights: [{ categoryId: "missing", value: 1 }] }
        },
        issuer()
      )
    ).toThrow(/custom Mekko weights/);
  });
});
