import { describe, expect, it } from "vitest";

import {
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
  type ChartDataInput,
  type ChartIdIssuer
} from "$lib/unique-components/chart";
import {
  layoutCategorySeries,
  layoutFunnel,
  layoutHeatmap,
  layoutMekko,
  layoutPoints,
  layoutRadar,
  layoutTreemap,
  layoutWaterfall
} from "$lib/unique-components/chart/plot";

const issuer = (): ChartIdIssuer => {
  let next = 0;
  return (kind) => `${kind}-${++next}`;
};

const data: ChartDataInput = {
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
    { id: "datum-b-one", categoryKey: "b", seriesKey: "one", value: 20, x: 2, size: 16 },
    { id: "datum-c-one", categoryKey: "c", seriesKey: "one", value: 30, x: 3, size: 36 },
    { id: "datum-a-two", categoryKey: "a", seriesKey: "two", value: 5, x: 1.5, size: 9 },
    { id: "datum-b-two", categoryKey: "b", seriesKey: "two", value: 10, x: 2.5, size: 25 },
    { id: "datum-c-two", categoryKey: "c", seriesKey: "two", value: 15, x: 3.5, size: 49 }
  ]
};
const single: ChartDataInput = {
  categories: data.categories,
  series: [data.series[0]],
  values: data.values.filter((entry) => entry.seriesKey === "one")
};
const size = { width: 600, height: 320, pad: { top: 20, right: 20, bottom: 40, left: 60 } };

describe("additional native chart geometry", () => {
  it("keeps line and area point identity while deriving connecting paths", () => {
    const line = layoutCategorySeries(createLineChart({ data, curve: "smooth" }, issuer()), size);
    const area = layoutCategorySeries(
      createAreaChart({ data, layout: "stack" }, issuer()),
      size
    );
    expect(line.marks.map((mark) => mark.id)).toContain("datum-b-one");
    expect(line.series[0].path).toContain("C");
    expect(area.series.every((series) => series.areaPath?.endsWith("Z"))).toBe(true);
    expect(area.domain[1]).toBeGreaterThan(30);
  });

  it("maps scatter and bubble channels without changing datum ids", () => {
    const scatter = layoutPoints(createScatterChart({ data }, issuer()), size);
    const bubble = layoutPoints(
      createBubbleChart({ data, radius: { min: 4, max: 20 } }, issuer()),
      size
    );
    expect(scatter.marks.find((mark) => mark.id === "datum-a-one")).toBeDefined();
    expect(new Set(bubble.points.map((point) => point.radius)).size).toBeGreaterThan(2);
    expect(Math.max(...bubble.points.map((point) => point.radius))).toBeCloseTo(20);
  });

  it("derives waterfall cumulatives while identified totals reset to zero", () => {
    const chart = createWaterfallChart(
      { data: single, totals: ["category-a", "category-c"] },
      issuer()
    );
    const layout = layoutWaterfall(chart, size);
    expect(layout.connectors).toHaveLength(2);
    expect(layout.bars.find((bar) => bar.markId === "datum-c-one")).toMatchObject({
      start: 0,
      end: 30,
      total: true
    });
  });

  it("uses Mekko category totals for width and series shares for height", () => {
    const layout = layoutMekko(createMekkoChart({ data }, issuer()), size);
    expect(layout.bands[2].box.width).toBeGreaterThan(layout.bands[0].box.width);
    expect(layout.marks).toHaveLength(data.values.length);
    expect(layout.marks.find((mark) => mark.id === "datum-c-two")?.kind).toBe("segment");
  });

  it("produces addressable funnel, radar, heatmap, and treemap marks", () => {
    const funnel = layoutFunnel(createFunnelChart({ data: single }, issuer()), {
      width: 600,
      height: 320
    });
    const radar = layoutRadar(createRadarChart({ data }, issuer()), {
      width: 600,
      height: 320
    });
    const heatmap = layoutHeatmap(createHeatmapChart({ data }, issuer()), size);
    const treemap = layoutTreemap(createTreemapChart({ data: single }, issuer()), {
      width: 600,
      height: 320
    });
    expect(funnel.stages).toHaveLength(3);
    expect(radar.polygons).toHaveLength(2);
    expect(heatmap.cells).toHaveLength(6);
    expect(treemap.marks).toHaveLength(3);
    expect(treemap.total).toBe(60);
    expect(new Set([
      ...funnel.marks,
      ...radar.marks,
      ...heatmap.marks,
      ...treemap.marks
    ].map((mark) => mark.datumId)).has("datum-b-one")).toBe(true);
  });
});
