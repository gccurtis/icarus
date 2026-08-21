import type {
  BarChartModel,
  ChartAxisLineElement,
  ChartCagrLineElement,
  PieChartModel
} from "$json-store/types/data/chart";
import { cagrForLine } from "$lib/unique-components/chart/chart-model";
import type { ChartBand, ChartBox, ChartMark } from "$lib/unique-components/chart/chart-spec";
import { seriesColor } from "$lib/unique-components/chart/palette";

export type Box = ChartBox;

export type PlotSize = {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
};

export type BarLayout = BarChartModel["layout"];

export type BarLayoutResult = {
  marks: ChartMark[];
  bands: ChartBand[];
  ticks: { value: number; at: number }[];
  plot: ChartBox;
  domain: [number, number];
};

export type LaidOut = BarLayoutResult;

const niceStep = (span: number, count: number) => {
  const raw = span / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].map((n) => n * magnitude).find((n) => n >= raw) ?? magnitude * 10;
};

/** Nice round ticks from zero through a positive maximum. */
export const ticksFor = (max: number, count = 4): number[] => {
  if (max <= 0) return [0];
  const step = niceStep(max, count);
  const top = Math.ceil(max / step) * step;
  const result: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) result.push(value);
  return result;
};

export const niceDomain = (min: number, max: number, count = 4): [number, number] => {
  if (min === max) return min === 0 ? [0, 1] : [Math.min(0, min), Math.max(0, max)];
  const step = niceStep(max - min, count);
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
};

export const ticksIn = (domain: [number, number], count = 4) => {
  const [min, max] = domain;
  const step = niceStep(max - min, count);
  const first = Math.ceil(min / step) * step;
  const result: number[] = [];
  for (let value = first; value <= max + step / 2; value += step) {
    result.push(Math.abs(value) < step / 1_000_000 ? 0 : value);
  }
  if (result.length === 0) return [min, max];
  return result;
};

const datumMap = (chart: BarChartModel) =>
  new Map(chart.data.datums.map((entry) => [`${entry.categoryId}\u0000${entry.seriesId}`, entry]));

const domainFor = (
  chart: BarChartModel,
  visibleSeriesIds: ReadonlySet<string>,
  values: ReturnType<typeof datumMap>
): [number, number] => {
  const override = chart.axes.value.domain;
  if (override !== undefined && override[0] < override[1]) return [...override];

  if (chart.layout === "stack" || chart.layout === "expand") {
    const ends = chart.data.categories.flatMap((category) => {
      let positive = 0;
      let negative = 0;
      let divisor = 1;
      if (chart.layout === "expand") {
        divisor =
          chart.data.series
            .filter((series) => visibleSeriesIds.has(series.id))
            .reduce(
              (sum, series) =>
                sum + Math.abs(values.get(`${category.id}\u0000${series.id}`)?.value ?? 0),
              0
            ) || 1;
      }
      for (const series of chart.data.series) {
        if (!visibleSeriesIds.has(series.id)) continue;
        const raw = values.get(`${category.id}\u0000${series.id}`)?.value ?? 0;
        const value = raw / divisor;
        if (value >= 0) positive += value;
        else negative += value;
      }
      return [positive, negative];
    });
    return niceDomain(Math.min(0, ...ends), Math.max(0, ...ends));
  }

  const shown = chart.data.datums
    .filter((datum) => visibleSeriesIds.has(datum.seriesId))
    .map((datum) => datum.value);
  return niceDomain(Math.min(0, ...shown), Math.max(0, ...shown));
};

/** Produce addressable bar geometry from the persisted, identified data. */
export const layoutBars = (chart: BarChartModel, size: PlotSize): BarLayoutResult => {
  const { width, height, pad } = size;
  const horizontal = chart.orientation === "horizontal";
  const plot: ChartBox = {
    x: pad.left,
    y: pad.top,
    width: Math.max(0, width - pad.left - pad.right),
    height: Math.max(0, height - pad.top - pad.bottom)
  };

  const visible = chart.data.series.filter((entry) => !entry.hidden);
  const visibleIds = new Set(visible.map((entry) => entry.id));
  const values = datumMap(chart);
  const domain = domainFor(chart, visibleIds, values);
  const [domainMin, domainMax] = domain;
  const span = domainMax - domainMin || 1;
  const categoryExtent = horizontal ? plot.height : plot.width;
  const band = chart.data.categories.length > 0 ? categoryExtent / chart.data.categories.length : categoryExtent;
  const bandInset = band * 0.18;
  const bandWidth = Math.max(1, band - bandInset * 2);

  const positionOf = (value: number) =>
    horizontal
      ? plot.x + ((value - domainMin) / span) * plot.width
      : plot.y + plot.height - ((value - domainMin) / span) * plot.height;

  const ticks = ticksIn(domain).map((value) => ({ value, at: positionOf(value) }));
  const marks: ChartMark[] = [];
  const bands: ChartBand[] = [];

  chart.data.categories.forEach((category, categoryIndex) => {
    const bandStart = (horizontal ? plot.y : plot.x) + categoryIndex * band + bandInset;
    bands.push({
      categoryId: category.id,
      label: category.label,
      box: horizontal
        ? { x: plot.x, y: bandStart, width: plot.width, height: bandWidth }
        : { x: bandStart, y: plot.y, width: bandWidth, height: plot.height }
    });

    const divisor =
      chart.layout === "expand"
        ? visible.reduce(
            (sum, series) =>
              sum + Math.abs(values.get(`${category.id}\u0000${series.id}`)?.value ?? 0),
            0
          ) || 1
        : 1;
    let positiveCursor = 0;
    let negativeCursor = 0;

    visible.forEach((series, visibleIndex) => {
      const datum = values.get(`${category.id}\u0000${series.id}`);
      if (datum === undefined) return;
      const drawnValue = chart.layout === "expand" ? datum.value / divisor : datum.value;
      let from = 0;
      let to = drawnValue;

      if (chart.layout === "stack" || chart.layout === "expand") {
        if (drawnValue >= 0) {
          from = positiveCursor;
          to = positiveCursor + drawnValue;
          positiveCursor = to;
        } else {
          from = negativeCursor;
          to = negativeCursor + drawnValue;
          negativeCursor = to;
        }
      }

      const fromAt = positionOf(from);
      const toAt = positionOf(to);
      let thickness = bandWidth;
      let along = bandStart;

      if (chart.layout === "group") {
        const slot = bandWidth / Math.max(1, visible.length);
        const inset = slot * 0.08;
        thickness = Math.max(1, slot - inset * 2);
        along = bandStart + visibleIndex * slot + inset;
      } else if (chart.layout === "overlap") {
        thickness = Math.max(1, bandWidth * (1 - visibleIndex * 0.18));
        along = bandStart + (bandWidth - thickness) / 2;
      }

      const box: ChartBox = horizontal
        ? { x: Math.min(fromAt, toAt), y: along, width: Math.abs(toAt - fromAt), height: thickness }
        : { x: along, y: Math.min(fromAt, toAt), width: thickness, height: Math.abs(toAt - fromAt) };

      marks.push({
        id: datum.id,
        datumId: datum.id,
        kind: chart.layout === "stack" || chart.layout === "expand" ? "segment" : "bar",
        categoryId: category.id,
        categoryLabel: category.label,
        seriesId: series.id,
        seriesLabel: series.label,
        value: datum.value,
        color: datum.style?.color ?? series.color ?? seriesColor(chart.data.series.indexOf(series)),
        opacity: datum.style?.opacity ?? 1,
        box
      });
    });
  });

  return { marks, bands, ticks, plot, domain };
};

export type PlacedLabel = {
  markId: string;
  text: string;
  x: number;
  y: number;
  inside: boolean;
};

const MIN_INSIDE = 16;
const MIN_ACROSS = 26;

export const placeValueLabels = (
  marks: readonly ChartMark[],
  layout: BarLayout,
  horizontal: boolean,
  format: (value: number) => string
): PlacedLabel[] => {
  const stacked = layout === "stack" || layout === "expand";
  return marks.flatMap((mark): PlacedLabel[] => {
    if (mark.value === 0) return [];
    const along = horizontal ? mark.box.width : mark.box.height;
    const across = horizontal ? mark.box.height : mark.box.width;
    if (stacked) {
      if (along < MIN_INSIDE || across < MIN_ACROSS) return [];
      return [{
        markId: mark.id,
        text: format(mark.value),
        x: mark.box.x + mark.box.width / 2,
        y: mark.box.y + mark.box.height / 2,
        inside: true
      }];
    }
    if (across < MIN_ACROSS) return [];
    return [{
      markId: mark.id,
      text: format(mark.value),
      x: horizontal
        ? mark.value >= 0 ? mark.box.x + mark.box.width + 4 : mark.box.x - 4
        : mark.box.x + mark.box.width / 2,
      y: horizontal
        ? mark.box.y + mark.box.height / 2
        : mark.value >= 0 ? mark.box.y - 5 : mark.box.y + mark.box.height + 13,
      inside: false
    }];
  });
};

export const placeTotalLabels = (
  marks: readonly ChartMark[],
  bands: readonly ChartBand[],
  horizontal: boolean,
  format: (value: number) => string
): PlacedLabel[] =>
  bands.flatMap((band) => {
    const own = marks.filter((mark) => mark.categoryId === band.categoryId);
    if (own.length === 0) return [];
    const total = own.reduce((sum, mark) => sum + mark.value, 0);
    if (total === 0) return [];
    const edge = horizontal
      ? total >= 0
        ? Math.max(...own.map((mark) => mark.box.x + mark.box.width))
        : Math.min(...own.map((mark) => mark.box.x))
      : total >= 0
        ? Math.min(...own.map((mark) => mark.box.y))
        : Math.max(...own.map((mark) => mark.box.y + mark.box.height));
    return [{
      markId: `${band.categoryId}:total`,
      text: format(total),
      x: horizontal
        ? edge + (total >= 0 ? 6 : -6)
        : band.box.x + band.box.width / 2,
      y: horizontal
        ? band.box.y + band.box.height / 2
        : edge + (total >= 0 ? -6 : 14),
      inside: false
    }];
  });

const point = (centre: { x: number; y: number }, angle: number, radius: number) => ({
  x: centre.x + Math.cos(angle) * radius,
  y: centre.y + Math.sin(angle) * radius
});

const slicePath = (
  centre: { x: number; y: number },
  outer: number,
  inner: number,
  from: number,
  to: number
) => {
  const sweep = Math.max(0, to - from);
  if (sweep >= Math.PI * 2 - 0.000001) {
    const top = point(centre, -Math.PI / 2, outer);
    const bottom = point(centre, Math.PI / 2, outer);
    if (inner <= 0) {
      return `M ${centre.x} ${centre.y} L ${top.x} ${top.y} A ${outer} ${outer} 0 1 1 ${bottom.x} ${bottom.y} A ${outer} ${outer} 0 1 1 ${top.x} ${top.y} Z`;
    }
    const innerTop = point(centre, -Math.PI / 2, inner);
    const innerBottom = point(centre, Math.PI / 2, inner);
    return `M ${top.x} ${top.y} A ${outer} ${outer} 0 1 1 ${bottom.x} ${bottom.y} A ${outer} ${outer} 0 1 1 ${top.x} ${top.y} L ${innerTop.x} ${innerTop.y} A ${inner} ${inner} 0 1 0 ${innerBottom.x} ${innerBottom.y} A ${inner} ${inner} 0 1 0 ${innerTop.x} ${innerTop.y} Z`;
  }

  const outerStart = point(centre, from, outer);
  const outerEnd = point(centre, to, outer);
  const large = sweep > Math.PI ? 1 : 0;
  if (inner <= 0) {
    return `M ${centre.x} ${centre.y} L ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y} Z`;
  }
  const innerEnd = point(centre, to, inner);
  const innerStart = point(centre, from, inner);
  return `M ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 ${large} 0 ${innerStart.x} ${innerStart.y} Z`;
};

export type PieLayoutResult = {
  marks: ChartMark[];
  slices: { markId: string; path: string; mid: number }[];
  centre: { x: number; y: number };
  radius: number;
  total: number;
};

/** Slices use datum ids exactly as bars do. */
export const layoutPie = (
  chart: PieChartModel,
  size: { width: number; height: number }
): PieLayoutResult => {
  const centre = { x: size.width / 2, y: size.height / 2 };
  const radius = Math.max(0, Math.min(size.width, size.height) / 2 - 12);
  const inner = radius * chart.innerRadius;
  const series = chart.data.series[0];
  const datumByCategory = new Map(
    chart.data.datums
      .filter((datum) => datum.seriesId === series?.id)
      .map((datum) => [datum.categoryId, datum])
  );
  const values = chart.data.categories.map((category) =>
    Math.max(0, datumByCategory.get(category.id)?.value ?? 0)
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  const divisor = total || 1;
  let angle = -Math.PI / 2;
  const marks: ChartMark[] = [];
  const slices: PieLayoutResult["slices"] = [];

  chart.data.categories.forEach((category, index) => {
    const datum = datumByCategory.get(category.id);
    if (datum === undefined) return;
    const sweep = (values[index] / divisor) * Math.PI * 2;
    const from = angle;
    const to = angle + sweep;
    angle = to;
    const mid = (from + to) / 2;
    const labelPoint = point(centre, mid, inner + (radius - inner) * 0.52);
    slices.push({ markId: datum.id, path: slicePath(centre, radius, inner, from, to), mid });
    marks.push({
      id: datum.id,
      datumId: datum.id,
      kind: "slice",
      categoryId: category.id,
      categoryLabel: category.label,
      seriesId: series?.id ?? datum.seriesId,
      seriesLabel: series?.label ?? "Value",
      value: datum.value,
      color: datum.style?.color ?? seriesColor(index),
      opacity: datum.style?.opacity ?? 1,
      box: { x: labelPoint.x - 1, y: labelPoint.y - 1, width: 2, height: 2 }
    });
  });

  return { marks, slices, centre, radius, total };
};

export type ChartLineGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
};

export const lineForAxisElement = (
  chart: BarChartModel,
  layout: BarLayoutResult,
  element: ChartAxisLineElement
): ChartLineGeometry | undefined => {
  const horizontal = chart.orientation === "horizontal";
  if (element.position.kind === "category") {
    const categoryId = element.position.categoryId;
    const band = layout.bands.find((entry) => entry.categoryId === categoryId);
    if (band === undefined) return undefined;
    const at = horizontal ? band.box.y + band.box.height / 2 : band.box.x + band.box.width / 2;
    return horizontal
      ? { x1: layout.plot.x, y1: at, x2: layout.plot.x + layout.plot.width, y2: at, labelX: layout.plot.x + 4, labelY: at - 5 }
      : { x1: at, y1: layout.plot.y, x2: at, y2: layout.plot.y + layout.plot.height, labelX: at + 4, labelY: layout.plot.y + 12 };
  }

  const [min, max] = layout.domain;
  if (element.position.value < min || element.position.value > max) return undefined;
  const share = (element.position.value - min) / (max - min || 1);
  const at = horizontal
    ? layout.plot.x + share * layout.plot.width
    : layout.plot.y + layout.plot.height - share * layout.plot.height;
  return horizontal
    ? { x1: at, y1: layout.plot.y, x2: at, y2: layout.plot.y + layout.plot.height, labelX: at + 4, labelY: layout.plot.y + 12 }
    : { x1: layout.plot.x, y1: at, x2: layout.plot.x + layout.plot.width, y2: at, labelX: layout.plot.x + 4, labelY: at - 5 };
};

export const lineForCagr = (
  chart: BarChartModel,
  layout: BarLayoutResult,
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
  const horizontal = chart.orientation === "horizontal";
  const endpoint = (mark: ChartMark) =>
    horizontal
      ? { x: mark.box.x + mark.box.width, y: mark.box.y + mark.box.height / 2 }
      : { x: mark.box.x + mark.box.width / 2, y: mark.box.y };
  const a = endpoint(from);
  const b = endpoint(to);
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
