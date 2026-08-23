import type {
  AreaChartModel,
  BubbleChartModel,
  ChartAxisLineElement,
  ChartCagrLineElement,
  ChartDatum,
  ChartTrendLineElement,
  FunnelChartModel,
  HeatmapChartModel,
  LineChartModel,
  MekkoChartModel,
  RadarChartModel,
  ScatterChartModel,
  TreemapChartModel,
  WaterfallChartModel
} from "$json-store/types/data/chart";
import { cagrForLine, trendForLine } from "$lib/unique-components/chart/chart-model";
import type { ChartBand, ChartBox, ChartMark } from "$lib/unique-components/chart/chart-spec";
import { seriesColor } from "$lib/unique-components/chart/palette";
import { niceDomain, ticksIn, type ChartLineGeometry, type PlotSize } from "./layout";

type CategorySeriesChart = LineChartModel | AreaChartModel;
type PointChart = ScatterChartModel | BubbleChartModel;
type GrowthSeriesChart = LineChartModel | AreaChartModel;

const plotFor = ({ width, height, pad }: PlotSize): ChartBox => ({
  x: pad.left,
  y: pad.top,
  width: Math.max(0, width - pad.left - pad.right),
  height: Math.max(0, height - pad.top - pad.bottom)
});

const domainFor = (
  values: readonly number[],
  override: [number, number] | undefined,
  includeZero: boolean
): [number, number] => {
  if (override !== undefined && override[0] < override[1]) return [...override];
  if (values.length === 0) return [0, 1];
  const low = Math.min(...values);
  const high = Math.max(...values);
  return niceDomain(includeZero ? Math.min(0, low) : low, includeZero ? Math.max(0, high) : high);
};

const scaled = (value: number, domain: [number, number], from: number, extent: number) =>
  from + ((value - domain[0]) / (domain[1] - domain[0] || 1)) * extent;

const yScaled = (value: number, domain: [number, number], plot: ChartBox) =>
  plot.y + plot.height - ((value - domain[0]) / (domain[1] - domain[0] || 1)) * plot.height;

const datumByPair = (datums: readonly ChartDatum[]) =>
  new Map(datums.map((entry) => [`${entry.categoryId}\u0000${entry.seriesId}`, entry]));

const linePath = (
  points: readonly { x: number; y: number }[],
  curve: LineChartModel["curve"]
): string => {
  if (points.length === 0) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (curve === "step") {
      path += ` H ${current.x} V ${current.y}`;
    } else if (curve === "smooth") {
      const middle = (previous.x + current.x) / 2;
      path += ` C ${middle} ${previous.y}, ${middle} ${current.y}, ${current.x} ${current.y}`;
    } else {
      path += ` L ${current.x} ${current.y}`;
    }
  }
  return path;
};

export type SeriesPath = {
  seriesId: string;
  label: string;
  color: string;
  path: string;
  areaPath?: string;
};

export type CategorySeriesLayout = {
  marks: ChartMark[];
  bands: ChartBand[];
  series: SeriesPath[];
  ticks: { value: number; at: number }[];
  plot: ChartBox;
  domain: [number, number];
};

/**
 * Shared line/area layout. The persisted datum is always the selectable point;
 * the line or filled area is a projection connecting those identified facts.
 */
export const layoutCategorySeries = (
  chart: CategorySeriesChart,
  size: PlotSize
): CategorySeriesLayout => {
  const plot = plotFor(size);
  const visibleSeries = chart.data.series.filter((entry) => !entry.hidden);
  const pairs = datumByPair(chart.data.datums);
  const categoryCount = Math.max(1, chart.data.categories.length);
  const step = plot.width / categoryCount;
  const bands: ChartBand[] = chart.data.categories.map((category, index) => ({
    categoryId: category.id,
    label: category.label,
    box: { x: plot.x + index * step, y: plot.y, width: step, height: plot.height }
  }));

  const positions: {
    datum: ChartDatum;
    categoryId: string;
    seriesId: string;
    lower: number;
    upper: number;
  }[] = [];
  chart.data.categories.forEach((category) => {
    let positive = 0;
    let negative = 0;
    const divisor =
      chart.type === "area" && chart.layout === "expand"
        ? visibleSeries.reduce(
            (sum, series) =>
              sum + Math.abs(pairs.get(`${category.id}\u0000${series.id}`)?.value ?? 0),
            0
          ) || 1
        : 1;
    visibleSeries.forEach((series) => {
      const datum = pairs.get(`${category.id}\u0000${series.id}`);
      if (datum === undefined) return;
      const value = datum.value / divisor;
      let lower = chart.type === "area" ? 0 : value;
      let upper = value;
      if (chart.type === "area" && (chart.layout === "stack" || chart.layout === "expand")) {
        if (value >= 0) {
          lower = positive;
          upper = positive + value;
          positive = upper;
        } else {
          lower = negative;
          upper = negative + value;
          negative = upper;
        }
      }
      positions.push({
        datum,
        categoryId: category.id,
        seriesId: series.id,
        lower,
        upper
      });
    });
  });

  const domainValues =
    chart.type === "line"
      ? positions.map((entry) => entry.upper)
      : positions.flatMap((entry) => [entry.lower, entry.upper]);
  const domain = domainFor(domainValues, chart.axes.value.domain, chart.type === "area");
  const categoryIndex = new Map(chart.data.categories.map((entry, index) => [entry.id, index]));
  const categoryById = new Map(chart.data.categories.map((entry) => [entry.id, entry]));
  const seriesById = new Map(chart.data.series.map((entry) => [entry.id, entry]));
  const marks: ChartMark[] = positions.map((entry) => {
    const index = categoryIndex.get(entry.categoryId) ?? 0;
    const x = plot.x + step * (index + 0.5);
    const y = yScaled(entry.upper, domain, plot);
    const oneSeries = seriesById.get(entry.seriesId)!;
    const category = categoryById.get(entry.categoryId)!;
    return {
      id: entry.datum.id,
      datumId: entry.datum.id,
      kind: "point",
      categoryId: entry.categoryId,
      categoryLabel: category.label,
      seriesId: entry.seriesId,
      seriesLabel: oneSeries.label,
      value: entry.datum.value,
      label: entry.datum.label,
      color:
        entry.datum.style?.color ??
        oneSeries.color ??
        seriesColor(chart.data.series.indexOf(oneSeries)),
      opacity: entry.datum.style?.opacity ?? 1,
      box: { x: x - 6, y: y - 6, width: 12, height: 12 }
    };
  });

  const seriesPaths = visibleSeries.map((oneSeries): SeriesPath => {
    const ownPositions = positions
      .filter((entry) => entry.seriesId === oneSeries.id)
      .sort(
        (a, b) =>
          (categoryIndex.get(a.categoryId) ?? 0) - (categoryIndex.get(b.categoryId) ?? 0)
      );
    const upper = ownPositions.map((entry) => ({
      x: plot.x + step * ((categoryIndex.get(entry.categoryId) ?? 0) + 0.5),
      y: yScaled(entry.upper, domain, plot)
    }));
    const lower = [...ownPositions].reverse().map((entry) => ({
      x: plot.x + step * ((categoryIndex.get(entry.categoryId) ?? 0) + 0.5),
      y: yScaled(entry.lower, domain, plot)
    }));
    const areaPath =
      chart.type === "area" && upper.length > 0
        ? `${linePath(upper, chart.curve)} ${linePath(lower, chart.curve).replace(/^M /, "L ")} Z`
        : undefined;
    return {
      seriesId: oneSeries.id,
      label: oneSeries.label,
      color: oneSeries.color ?? seriesColor(chart.data.series.indexOf(oneSeries)),
      path: linePath(upper, chart.curve),
      ...(areaPath === undefined ? {} : { areaPath })
    };
  });

  return {
    marks,
    bands,
    series: seriesPaths,
    ticks: ticksIn(domain).map((value) => ({ value, at: yScaled(value, domain, plot) })),
    plot,
    domain
  };
};

export type PointLayout = {
  marks: ChartMark[];
  points: { markId: string; x: number; y: number; radius: number }[];
  xTicks: { value: number; at: number }[];
  yTicks: { value: number; at: number }[];
  plot: ChartBox;
  xDomain: [number, number];
  yDomain: [number, number];
};

export const layoutPoints = (chart: PointChart, size: PlotSize): PointLayout => {
  const plot = plotFor(size);
  const visibleIds = new Set(
    chart.data.series.filter((entry) => !entry.hidden).map((entry) => entry.id)
  );
  const data = chart.data.datums.filter(
    (entry): entry is ChartDatum & { x: number } =>
      visibleIds.has(entry.seriesId) && entry.x !== undefined
  );
  const xDomain = domainFor(
    data.map((entry) => entry.x),
    chart.axes.x.domain,
    false
  );
  const yDomain = domainFor(
    data.map((entry) => entry.value),
    chart.axes.y.domain,
    false
  );
  const sizeValues =
    chart.type === "bubble"
      ? data.map((entry) => Math.max(0, entry.size ?? 0))
      : [];
  const sizeMin = sizeValues.length === 0 ? 0 : Math.min(...sizeValues);
  const sizeMax = sizeValues.length === 0 ? 1 : Math.max(...sizeValues);
  const categoryById = new Map(chart.data.categories.map((entry) => [entry.id, entry]));
  const seriesById = new Map(chart.data.series.map((entry) => [entry.id, entry]));
  const points: PointLayout["points"] = [];
  const marks = data.map((entry): ChartMark => {
    const x = scaled(entry.x, xDomain, plot.x, plot.width);
    const y = yScaled(entry.value, yDomain, plot);
    const radius =
      chart.type === "bubble"
        ? chart.radius.min +
          Math.sqrt((Math.max(0, entry.size ?? 0) - sizeMin) / (sizeMax - sizeMin || 1)) *
            (chart.radius.max - chart.radius.min)
        : 5;
    const category = categoryById.get(entry.categoryId)!;
    const oneSeries = seriesById.get(entry.seriesId)!;
    points.push({ markId: entry.id, x, y, radius });
    return {
      id: entry.id,
      datumId: entry.id,
      kind: chart.type === "bubble" ? "bubble" : "point",
      categoryId: entry.categoryId,
      categoryLabel: category.label,
      seriesId: entry.seriesId,
      seriesLabel: oneSeries.label,
      value: entry.value,
      label: entry.label,
      color:
        entry.style?.color ??
        oneSeries.color ??
        seriesColor(chart.data.series.indexOf(oneSeries)),
      opacity: entry.style?.opacity ?? 1,
      box: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 }
    };
  });
  return {
    marks,
    points,
    xTicks: ticksIn(xDomain).map((value) => ({
      value,
      at: scaled(value, xDomain, plot.x, plot.width)
    })),
    yTicks: ticksIn(yDomain).map((value) => ({ value, at: yScaled(value, yDomain, plot) })),
    plot,
    xDomain,
    yDomain
  };
};

export type WaterfallLayout = {
  marks: ChartMark[];
  bars: { markId: string; start: number; end: number; total: boolean }[];
  connectors: { x1: number; y1: number; x2: number; y2: number }[];
  bands: ChartBand[];
  ticks: { value: number; at: number }[];
  plot: ChartBox;
  domain: [number, number];
};

export const layoutWaterfall = (
  chart: WaterfallChartModel,
  size: PlotSize
): WaterfallLayout => {
  const plot = plotFor(size);
  const oneSeries = chart.data.series[0];
  const pairs = datumByPair(chart.data.datums);
  const totalIds = new Set(chart.totals);
  let cursor = 0;
  const staged = chart.data.categories.flatMap((category) => {
    const datum = pairs.get(`${category.id}\u0000${oneSeries?.id ?? ""}`);
    if (datum === undefined) return [];
    const total = totalIds.has(category.id);
    const start = total ? 0 : cursor;
    const end = total ? datum.value : cursor + datum.value;
    cursor = end;
    return [{ category, datum, start, end, total }];
  });
  const domain = domainFor(
    staged.flatMap((entry) => [entry.start, entry.end]),
    chart.axes.value.domain,
    true
  );
  const step = plot.width / Math.max(1, staged.length);
  const inset = step * 0.18;
  const marks: ChartMark[] = [];
  const bars: WaterfallLayout["bars"] = [];
  const bands: ChartBand[] = [];
  staged.forEach((entry, index) => {
    const x = plot.x + step * index + inset;
    const top = yScaled(Math.max(entry.start, entry.end), domain, plot);
    const bottom = yScaled(Math.min(entry.start, entry.end), domain, plot);
    const box = { x, y: top, width: Math.max(1, step - inset * 2), height: Math.abs(bottom - top) };
    const color = entry.total
      ? chart.colors.total
      : entry.end >= entry.start
        ? chart.colors.increase
        : chart.colors.decrease;
    marks.push({
      id: entry.datum.id,
      datumId: entry.datum.id,
      kind: "step",
      categoryId: entry.category.id,
      categoryLabel: entry.category.label,
      seriesId: oneSeries?.id ?? entry.datum.seriesId,
      seriesLabel: oneSeries?.label ?? "Change",
      value: entry.datum.value,
      label: entry.datum.label,
      color: entry.datum.style?.color ?? color,
      opacity: entry.datum.style?.opacity ?? 1,
      box
    });
    bars.push({ markId: entry.datum.id, start: entry.start, end: entry.end, total: entry.total });
    bands.push({
      categoryId: entry.category.id,
      label: entry.category.label,
      box: { x: plot.x + step * index, y: plot.y, width: step, height: plot.height }
    });
  });
  const connectors = staged.slice(0, -1).map((entry, index) => {
    const at = yScaled(entry.end, domain, plot);
    return {
      x1: plot.x + step * (index + 1) - inset,
      y1: at,
      x2: plot.x + step * (index + 1) + inset,
      y2: at
    };
  });
  return {
    marks,
    bars,
    connectors,
    bands,
    ticks: ticksIn(domain).map((value) => ({ value, at: yScaled(value, domain, plot) })),
    plot,
    domain
  };
};

export type MekkoLayout = {
  marks: ChartMark[];
  bands: (ChartBand & { share: number })[];
  ticks: { value: number; at: number }[];
  plot: ChartBox;
  domain: [number, number];
};

export const layoutMekko = (chart: MekkoChartModel, size: PlotSize): MekkoLayout => {
  const plot = plotFor(size);
  const visible = chart.data.series.filter((entry) => !entry.hidden);
  const pairs = datumByPair(chart.data.datums);
  const totals = new Map(
    chart.data.categories.map((category) => [
      category.id,
      visible.reduce(
        (sum, series) => sum + Math.max(0, pairs.get(`${category.id}\u0000${series.id}`)?.value ?? 0),
        0
      )
    ])
  );
  const custom =
    chart.widths.kind === "custom"
      ? new Map(chart.widths.weights.map((entry) => [entry.categoryId, entry.value]))
      : undefined;
  const weights = chart.data.categories.map((category) =>
    chart.widths.kind === "equal"
      ? 1
      : chart.widths.kind === "custom"
        ? custom?.get(category.id) ?? 0
        : totals.get(category.id) ?? 0
  );
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const gap = plot.width * chart.gap;
  const usable = Math.max(0, plot.width - gap * Math.max(0, chart.data.categories.length - 1));
  let cursor = plot.x;
  const marks: ChartMark[] = [];
  const bands: MekkoLayout["bands"] = [];
  chart.data.categories.forEach((category, categoryIndex) => {
    const width = (weights[categoryIndex] / weightTotal) * usable;
    const total = totals.get(category.id) || 1;
    let shareCursor = 0;
    bands.push({
      categoryId: category.id,
      label: category.label,
      share: weights[categoryIndex] / weightTotal,
      box: { x: cursor, y: plot.y, width, height: plot.height }
    });
    visible.forEach((series) => {
      const datum = pairs.get(`${category.id}\u0000${series.id}`);
      if (datum === undefined) return;
      const share = Math.max(0, datum.value) / total;
      const height = share * plot.height;
      const box = {
        x: cursor,
        y: plot.y + plot.height - (shareCursor + share) * plot.height,
        width,
        height
      };
      shareCursor += share;
      marks.push({
        id: datum.id,
        datumId: datum.id,
        kind: "segment",
        categoryId: category.id,
        categoryLabel: category.label,
        seriesId: series.id,
        seriesLabel: series.label,
        value: datum.value,
        label: datum.label,
        color:
          datum.style?.color ?? series.color ?? seriesColor(chart.data.series.indexOf(series)),
        opacity: datum.style?.opacity ?? 1,
        box
      });
    });
    cursor += width + gap;
  });
  return {
    marks,
    bands,
    ticks: [0, 0.25, 0.5, 0.75, 1].map((value) => ({
      value,
      at: yScaled(value, [0, 1], plot)
    })),
    plot,
    domain: [0, 1]
  };
};

export type FunnelLayout = {
  marks: ChartMark[];
  stages: { markId: string; path: string; center: { x: number; y: number } }[];
  total: number;
  first: number;
};

export const layoutFunnel = (
  chart: FunnelChartModel,
  size: { width: number; height: number }
): FunnelLayout => {
  const plot = {
    x: 24,
    y: 12,
    width: Math.max(0, size.width - 48),
    height: Math.max(0, size.height - 24)
  };
  const oneSeries = chart.data.series[0];
  const pairs = datumByPair(chart.data.datums);
  const rows = chart.data.categories.flatMap((category) => {
    const datum = pairs.get(`${category.id}\u0000${oneSeries?.id ?? ""}`);
    return datum === undefined ? [] : [{ category, datum }];
  });
  const max = Math.max(0, ...rows.map((entry) => entry.datum.value)) || 1;
  const first = rows[0]?.datum.value ?? 0;
  const stageHeight = plot.height / Math.max(1, rows.length);
  const stages: FunnelLayout["stages"] = [];
  const marks: ChartMark[] = [];
  rows.forEach((entry, index) => {
    const currentShare = entry.datum.value / max;
    const nextShare =
      index === rows.length - 1
        ? currentShare * chart.neck
        : (rows[index + 1]?.datum.value ?? entry.datum.value) / max;
    const topWidth = plot.width * currentShare;
    const bottomWidth = plot.width * nextShare;
    const y = plot.y + index * stageHeight;
    const leftTop = plot.x + (plot.width - topWidth) / 2;
    const leftBottom = plot.x + (plot.width - bottomWidth) / 2;
    const path = `M ${leftTop} ${y} L ${leftTop + topWidth} ${y} L ${leftBottom + bottomWidth} ${y + stageHeight} L ${leftBottom} ${y + stageHeight} Z`;
    const center = { x: plot.x + plot.width / 2, y: y + stageHeight / 2 };
    const color =
      entry.datum.style?.color ??
      seriesColor(chart.data.categories.indexOf(entry.category));
    stages.push({ markId: entry.datum.id, path, center });
    marks.push({
      id: entry.datum.id,
      datumId: entry.datum.id,
      kind: "step",
      categoryId: entry.category.id,
      categoryLabel: entry.category.label,
      seriesId: oneSeries?.id ?? entry.datum.seriesId,
      seriesLabel: oneSeries?.label ?? "Value",
      value: entry.datum.value,
      label: entry.datum.label,
      color,
      opacity: entry.datum.style?.opacity ?? 1,
      box: {
        x: Math.min(leftTop, leftBottom),
        y,
        width: Math.max(topWidth, bottomWidth),
        height: stageHeight
      }
    });
  });
  return {
    marks,
    stages,
    total: rows.reduce((sum, entry) => sum + entry.datum.value, 0),
    first
  };
};

const polarPoint = (center: { x: number; y: number }, angle: number, radius: number) => ({
  x: center.x + Math.cos(angle) * radius,
  y: center.y + Math.sin(angle) * radius
});

export type RadarLayout = {
  marks: ChartMark[];
  polygons: { seriesId: string; path: string; color: string }[];
  rings: string[];
  spokes: { categoryId: string; label: string; x: number; y: number; labelX: number; labelY: number }[];
  center: { x: number; y: number };
  radius: number;
  domain: [number, number];
};

export const layoutRadar = (
  chart: RadarChartModel,
  size: { width: number; height: number }
): RadarLayout => {
  const center = { x: size.width / 2, y: size.height / 2 };
  const radius = Math.max(0, Math.min(size.width, size.height) / 2 - 34);
  const domain =
    chart.axes.value.domain ??
    niceDomain(0, Math.max(0, ...chart.data.datums.map((entry) => entry.value)));
  const visible = chart.data.series.filter((entry) => !entry.hidden);
  const pairs = datumByPair(chart.data.datums);
  const angleFor = (index: number) =>
    -Math.PI / 2 + (index / Math.max(1, chart.data.categories.length)) * Math.PI * 2;
  const radial = (value: number) =>
    ((value - domain[0]) / (domain[1] - domain[0] || 1)) * radius;
  const spokes = chart.data.categories.map((category, index) => {
    const angle = angleFor(index);
    const end = polarPoint(center, angle, radius);
    const label = polarPoint(center, angle, radius + 16);
    return {
      categoryId: category.id,
      label: category.label,
      x: end.x,
      y: end.y,
      labelX: label.x,
      labelY: label.y
    };
  });
  const rings = [0.25, 0.5, 0.75, 1].map(
    (share) =>
      chart.data.categories
        .map((_, index) => {
          const point = polarPoint(center, angleFor(index), radius * share);
          return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
        })
        .join(" ") + " Z"
  );
  const marks: ChartMark[] = [];
  const polygons = visible.map((series) => {
    const points = chart.data.categories.flatMap((category, index) => {
      const datum = pairs.get(`${category.id}\u0000${series.id}`);
      if (datum === undefined) return [];
      const point = polarPoint(center, angleFor(index), radial(datum.value));
      marks.push({
        id: datum.id,
        datumId: datum.id,
        kind: "point",
        categoryId: category.id,
        categoryLabel: category.label,
        seriesId: series.id,
        seriesLabel: series.label,
        value: datum.value,
        label: datum.label,
        color:
          datum.style?.color ?? series.color ?? seriesColor(chart.data.series.indexOf(series)),
        opacity: datum.style?.opacity ?? 1,
        box: { x: point.x - 6, y: point.y - 6, width: 12, height: 12 }
      });
      return [point];
    });
    return {
      seriesId: series.id,
      color: series.color ?? seriesColor(chart.data.series.indexOf(series)),
      path:
        points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ") +
        " Z"
    };
  });
  return { marks, polygons, rings, spokes, center, radius, domain };
};

export type HeatmapLayout = {
  marks: ChartMark[];
  cells: { markId: string; intensity: number }[];
  categoryBands: ChartBand[];
  seriesBands: { seriesId: string; label: string; box: ChartBox }[];
  plot: ChartBox;
  domain: [number, number];
};

export const layoutHeatmap = (chart: HeatmapChartModel, size: PlotSize): HeatmapLayout => {
  const plot = plotFor(size);
  const visibleSeries = chart.data.series.filter((entry) => !entry.hidden);
  const values = chart.data.datums.map((entry) => entry.value);
  const domain =
    chart.scale.domain ??
    (values.length === 0 ? [0, 1] : niceDomain(Math.min(...values), Math.max(...values)));
  const cellWidth = plot.width / Math.max(1, chart.data.categories.length);
  const cellHeight = plot.height / Math.max(1, visibleSeries.length);
  const categoryIndex = new Map(chart.data.categories.map((entry, index) => [entry.id, index]));
  const seriesIndex = new Map(visibleSeries.map((entry, index) => [entry.id, index]));
  const categoryById = new Map(chart.data.categories.map((entry) => [entry.id, entry]));
  const seriesById = new Map(chart.data.series.map((entry) => [entry.id, entry]));
  const cells: HeatmapLayout["cells"] = [];
  const marks = chart.data.datums.flatMap((datum): ChartMark[] => {
    const xIndex = categoryIndex.get(datum.categoryId);
    const yIndex = seriesIndex.get(datum.seriesId);
    if (xIndex === undefined || yIndex === undefined) return [];
    const category = categoryById.get(datum.categoryId)!;
    const series = seriesById.get(datum.seriesId)!;
    const box = {
      x: plot.x + xIndex * cellWidth,
      y: plot.y + yIndex * cellHeight,
      width: cellWidth,
      height: cellHeight
    };
    cells.push({
      markId: datum.id,
      intensity: Math.min(1, Math.max(0, (datum.value - domain[0]) / (domain[1] - domain[0] || 1)))
    });
    return [{
      id: datum.id,
      datumId: datum.id,
      kind: "cell",
      categoryId: datum.categoryId,
      categoryLabel: category.label,
      seriesId: datum.seriesId,
      seriesLabel: series.label,
      value: datum.value,
      label: datum.label,
      color: datum.style?.color ?? chart.scale.highColor,
      opacity: datum.style?.opacity ?? 1,
      box
    }];
  });
  return {
    marks,
    cells,
    categoryBands: chart.data.categories.map((category, index) => ({
      categoryId: category.id,
      label: category.label,
      box: { x: plot.x + index * cellWidth, y: plot.y, width: cellWidth, height: plot.height }
    })),
    seriesBands: visibleSeries.map((series, index) => ({
      seriesId: series.id,
      label: series.label,
      box: { x: plot.x, y: plot.y + index * cellHeight, width: plot.width, height: cellHeight }
    })),
    plot,
    domain
  };
};

type TreemapItem = {
  datum: ChartDatum;
  category: TreemapChartModel["data"]["categories"][number];
  value: number;
};

const partitionTreemap = (
  items: readonly TreemapItem[],
  box: ChartBox,
  vertical: boolean,
  output: { item: TreemapItem; box: ChartBox }[]
) => {
  if (items.length === 0) return;
  if (items.length === 1) {
    output.push({ item: items[0], box });
    return;
  }
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let leftTotal = 0;
  let split = 1;
  while (split < items.length - 1 && leftTotal + items[split - 1].value < total / 2) {
    leftTotal += items[split - 1].value;
    split += 1;
  }
  leftTotal = items.slice(0, split).reduce((sum, item) => sum + item.value, 0);
  const share = leftTotal / total;
  const first = vertical
    ? { ...box, width: box.width * share }
    : { ...box, height: box.height * share };
  const second = vertical
    ? { x: box.x + first.width, y: box.y, width: box.width - first.width, height: box.height }
    : { x: box.x, y: box.y + first.height, width: box.width, height: box.height - first.height };
  partitionTreemap(items.slice(0, split), first, !vertical, output);
  partitionTreemap(items.slice(split), second, !vertical, output);
};

export type TreemapLayout = {
  marks: ChartMark[];
  total: number;
};

export const layoutTreemap = (
  chart: TreemapChartModel,
  size: { width: number; height: number }
): TreemapLayout => {
  const oneSeries = chart.data.series[0];
  const pairs = datumByPair(chart.data.datums);
  const items = chart.data.categories
    .flatMap((category): TreemapItem[] => {
      const datum = pairs.get(`${category.id}\u0000${oneSeries?.id ?? ""}`);
      return datum === undefined || datum.value <= 0
        ? []
        : [{ datum, category, value: datum.value }];
    })
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const placed: { item: TreemapItem; box: ChartBox }[] = [];
  partitionTreemap(
    items,
    {
      x: 8,
      y: 8,
      width: Math.max(0, size.width - 16),
      height: Math.max(0, size.height - 16)
    },
    size.width >= size.height,
    placed
  );
  const gap = Math.min(size.width, size.height) * chart.gap;
  return {
    total,
    marks: placed.map(({ item, box }, index) => ({
      id: item.datum.id,
      datumId: item.datum.id,
      kind: "tile",
      categoryId: item.category.id,
      categoryLabel: item.category.label,
      seriesId: oneSeries?.id ?? item.datum.seriesId,
      seriesLabel: oneSeries?.label ?? "Value",
      value: item.datum.value,
      label: item.datum.label,
      color: item.datum.style?.color ?? seriesColor(index),
      opacity: item.datum.style?.opacity ?? 1,
      box: {
        x: box.x + gap / 2,
        y: box.y + gap / 2,
        width: Math.max(0, box.width - gap),
        height: Math.max(0, box.height - gap)
      }
    }))
  };
};

export const lineForCategoryAxis = (
  axes: { category: ChartAxisLineElement["axisId"]; value: ChartAxisLineElement["axisId"] },
  layout: Pick<CategorySeriesLayout | WaterfallLayout | MekkoLayout, "bands" | "plot" | "domain">,
  element: ChartAxisLineElement
): ChartLineGeometry | undefined => {
  if (element.axisId === axes.category && element.position.kind === "category") {
    const categoryId = element.position.categoryId;
    const band = layout.bands.find((entry) => entry.categoryId === categoryId);
    if (band === undefined) return undefined;
    const at = band.box.x + band.box.width / 2;
    return {
      x1: at,
      y1: layout.plot.y,
      x2: at,
      y2: layout.plot.y + layout.plot.height,
      labelX: at + 4,
      labelY: layout.plot.y + 12
    };
  }
  if (element.axisId !== axes.value || element.position.kind !== "value") return undefined;
  if (element.position.value < layout.domain[0] || element.position.value > layout.domain[1]) {
    return undefined;
  }
  const at = yScaled(element.position.value, layout.domain, layout.plot);
  return {
    x1: layout.plot.x,
    y1: at,
    x2: layout.plot.x + layout.plot.width,
    y2: at,
    labelX: layout.plot.x + 4,
    labelY: at - 5
  };
};

export const cagrForCategorySeries = (
  chart: GrowthSeriesChart,
  layout: CategorySeriesLayout,
  element: ChartCagrLineElement
): (ChartLineGeometry & { rate: number }) | undefined => {
  const from = layout.marks.find(
    (mark) => mark.categoryId === element.fromCategoryId && mark.seriesId === element.seriesId
  );
  const to = layout.marks.find(
    (mark) => mark.categoryId === element.toCategoryId && mark.seriesId === element.seriesId
  );
  const rate = cagrForLine(chart, element);
  if (from === undefined || to === undefined || rate === undefined) return undefined;
  const a = { x: from.box.x + from.box.width / 2, y: from.box.y + from.box.height / 2 };
  const b = { x: to.box.x + to.box.width / 2, y: to.box.y + to.box.height / 2 };
  return {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    labelX: (a.x + b.x) / 2,
    labelY: (a.y + b.y) / 2 - 8,
    rate
  };
};

export const lineForNumericAxis = (
  chart: PointChart,
  layout: PointLayout,
  element: ChartAxisLineElement
): ChartLineGeometry | undefined => {
  if (element.position.kind !== "value") return undefined;
  if (element.axisId === chart.axes.x.id) {
    if (element.position.value < layout.xDomain[0] || element.position.value > layout.xDomain[1]) {
      return undefined;
    }
    const at = scaled(element.position.value, layout.xDomain, layout.plot.x, layout.plot.width);
    return {
      x1: at,
      y1: layout.plot.y,
      x2: at,
      y2: layout.plot.y + layout.plot.height,
      labelX: at + 4,
      labelY: layout.plot.y + 12
    };
  }
  if (element.axisId !== chart.axes.y.id) return undefined;
  if (element.position.value < layout.yDomain[0] || element.position.value > layout.yDomain[1]) {
    return undefined;
  }
  const at = yScaled(element.position.value, layout.yDomain, layout.plot);
  return {
    x1: layout.plot.x,
    y1: at,
    x2: layout.plot.x + layout.plot.width,
    y2: at,
    labelX: layout.plot.x + 4,
    labelY: at - 5
  };
};

export const lineForTrend = (
  chart: PointChart,
  layout: PointLayout,
  element: ChartTrendLineElement
): (ChartLineGeometry & { equation: string; rSquared: number }) | undefined => {
  const trend = trendForLine(chart, element);
  if (trend === undefined) return undefined;
  const x1Value = layout.xDomain[0];
  const x2Value = layout.xDomain[1];
  const y1Value = trend.slope * x1Value + trend.intercept;
  const y2Value = trend.slope * x2Value + trend.intercept;
  const x1 = layout.plot.x;
  const x2 = layout.plot.x + layout.plot.width;
  const y1 = yScaled(y1Value, layout.yDomain, layout.plot);
  const y2 = yScaled(y2Value, layout.yDomain, layout.plot);
  return {
    x1,
    y1,
    x2,
    y2,
    labelX: (x1 + x2) / 2,
    labelY: (y1 + y2) / 2 - 8,
    equation: `y = ${trend.slope.toFixed(2)}x ${trend.intercept < 0 ? "−" : "+"} ${Math.abs(trend.intercept).toFixed(2)}`,
    rSquared: trend.rSquared
  };
};
