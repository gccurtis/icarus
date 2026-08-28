import { markId, type Mark, type SeriesSpec } from "$authored-components/chart/chart-spec";
import { seriesColor } from "$authored-components/chart/palette";

/**
 * Turning data into positioned things, with no drawing anywhere in it.
 *
 * **This is the file the whole family exists for.** A renderer that draws
 * straight from data can only be styled as a whole and can only be pointed at as
 * a whole. Producing marks first — one addressable rectangle per bar or segment,
 * each carrying where it is and what it means — is what makes selecting a single
 * bar of a cluster, labelling a segment in its own middle, or colouring one
 * slice differently into ordinary operations rather than fights with a library.
 *
 * It is pure functions over numbers, so the geometry can be checked by reading
 * it. Geometry sealed inside somebody else's components can be measured landing
 * labels on top of one another, and not corrected.
 */
export type Box = { x: number; y: number; width: number; height: number };

export type PlotSize = {
  width: number;
  height: number;
  /** Room for the axes. The value side is wider because it holds figures. */
  pad: { top: number; right: number; bottom: number; left: number };
};

export type BarLayout = "stack" | "group" | "expand" | "overlap";

export type LaidOut = {
  marks: Mark[];
  /** Where each category's band sits, for axis labels and whole-column clicks. */
  bands: { category: string; box: Box }[];
  /** The value axis ticks, already positioned. */
  ticks: { value: number; at: number }[];
  /** The plot rectangle itself, inside the padding. */
  plot: Box;
  /** The value axis maximum actually used. */
  max: number;
};

const numberAt = (row: Record<string, unknown>, key: string) => {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
};

/**
 * Nice round ticks covering `max`.
 *
 * Rounding up to a round number rather than ending the axis exactly at the
 * tallest bar: an axis whose top is 1,842 makes every bar look full-height and
 * makes two charts of the same quantity incomparable.
 */
export const ticksFor = (max: number, count = 4): number[] => {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((n) => n * magnitude).find((n) => n >= raw) ?? magnitude * 10;
  const top = Math.ceil(max / step) * step;

  const out: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) out.push(value);
  return out;
};

/**
 * Every bar, as a mark.
 *
 * Horizontal is not a transpose applied afterwards — the category axis and the
 * value axis are chosen up front and every box is built in final coordinates.
 * Rotating a finished vertical layout is what gives upside-down stacks and
 * mirrored groups.
 */
export const layoutBars = (
  data: readonly Record<string, unknown>[],
  categoryField: string,
  series: readonly SeriesSpec[],
  layout: BarLayout,
  horizontal: boolean,
  size: PlotSize
): LaidOut => {
  const { width, height, pad } = size;
  const plot: Box = {
    x: pad.left,
    y: pad.top,
    width: Math.max(0, width - pad.left - pad.right),
    height: Math.max(0, height - pad.top - pad.bottom)
  };

  const visible = series.filter((entry) => !entry.hidden);
  const categories = data.map((row) => String(row[categoryField] ?? ""));

  /** The axis the categories run along, and the one the values run along. */
  const categoryExtent = horizontal ? plot.height : plot.width;
  const valueExtent = horizontal ? plot.width : plot.height;

  const band = categories.length > 0 ? categoryExtent / categories.length : categoryExtent;
  const bandInset = band * 0.18;
  const bandWidth = Math.max(1, band - bandInset * 2);

  const totals = data.map((row) =>
    visible.reduce((sum, entry) => sum + numberAt(row, entry.key), 0)
  );

  /** `expand` normalises each column to its own total, so the axis is a share. */
  const max =
    layout === "expand"
      ? 1
      : layout === "stack"
        ? Math.max(0, ...totals)
        : Math.max(
            0,
            ...data.flatMap((row) => visible.map((entry) => numberAt(row, entry.key)))
          );

  const ticks = (layout === "expand" ? [0, 0.25, 0.5, 0.75, 1] : ticksFor(max)).map((value) => ({
    value,
    at: 0
  }));
  const axisTop = layout === "expand" ? 1 : (ticks.at(-1)?.value ?? max) || 1;

  /** A value as a distance along the value axis. */
  const lengthOf = (value: number) => (axisTop === 0 ? 0 : (value / axisTop) * valueExtent);

  for (const tick of ticks) {
    tick.at = horizontal ? plot.x + lengthOf(tick.value) : plot.y + plot.height - lengthOf(tick.value);
  }

  const marks: Mark[] = [];
  const bands: { category: string; box: Box }[] = [];

  data.forEach((row, index) => {
    const category = categories[index];
    const bandStart = (horizontal ? plot.y : plot.x) + index * band + bandInset;

    bands.push({
      category,
      box: horizontal
        ? { x: plot.x, y: bandStart, width: plot.width, height: bandWidth }
        : { x: bandStart, y: plot.y, width: bandWidth, height: plot.height }
    });

    // `expand` divides by the column's own total; a column of nothing stays at
    // nothing rather than becoming NaN geometry.
    const divisor = layout === "expand" ? totals[index] || 1 : 1;

    let cursor = 0;
    visible.forEach((entry, seriesIndex) => {
      const raw = numberAt(row, entry.key);
      const value = layout === "expand" ? raw / divisor : raw;
      const length = lengthOf(Math.abs(value));
      const color = entry.color ?? seriesColor(series.indexOf(entry));

      let box: Box;

      if (layout === "group") {
        const slot = bandWidth / Math.max(1, visible.length);
        const slotInset = slot * 0.08;
        const thickness = Math.max(1, slot - slotInset * 2);
        const along = bandStart + seriesIndex * slot + slotInset;

        box = horizontal
          ? { x: plot.x, y: along, width: length, height: thickness }
          : { x: along, y: plot.y + plot.height - length, width: thickness, height: length };
      } else if (layout === "overlap") {
        // Widest first so a shorter series in front stays visible.
        const thickness = bandWidth * (1 - seriesIndex * 0.18);
        const along = bandStart + (bandWidth - thickness) / 2;

        box = horizontal
          ? { x: plot.x, y: along, width: length, height: thickness }
          : { x: along, y: plot.y + plot.height - length, width: thickness, height: length };
      } else {
        box = horizontal
          ? { x: plot.x + cursor, y: bandStart, width: length, height: bandWidth }
          : {
              x: bandStart,
              y: plot.y + plot.height - cursor - length,
              width: bandWidth,
              height: length
            };
        cursor += length;
      }

      marks.push({
        id: markId(category, entry.key),
        kind: layout === "stack" || layout === "expand" ? "segment" : "bar",
        category,
        seriesKey: entry.key,
        value: raw,
        color,
        box
      });
    });
  });

  return { marks, bands, ticks, plot, max: axisTop };
};

/**
 * Where a figure goes, and whether it goes at all.
 *
 * **The rule.** A stacked segment's label belongs in the middle of *that
 * segment*, not in the middle of the column — a label placed against the column
 * puts every segment's figure at the same y, three numbers on top of each other.
 * A clustered bar's label belongs directly above *that bar*, centred on it, not
 * offset diagonally into its neighbour.
 *
 * **A label that does not fit is dropped, never drawn overlapping.** The number
 * is still on the mark's `<title>`, so nothing is lost — a figure sitting across
 * two segments is worse than a figure you have to hover for.
 */
export type PlacedLabel = {
  markId: string;
  text: string;
  x: number;
  y: number;
  /** Inside a filled mark, so it needs on-fill ink. */
  inside: boolean;
};

const MIN_INSIDE = 16;
const MIN_ACROSS = 26;

export const placeValueLabels = (
  marks: readonly Mark[],
  layout: BarLayout,
  horizontal: boolean,
  format: (value: number) => string
): PlacedLabel[] => {
  const stacked = layout === "stack" || layout === "expand";

  return marks.flatMap((mark): PlacedLabel[] => {
    const { box } = mark;
    if (mark.value === 0) return [];

    if (stacked) {
      // Centred in its own segment, and only if the segment can hold it.
      const along = horizontal ? box.width : box.height;
      const across = horizontal ? box.height : box.width;
      if (along < MIN_INSIDE || across < MIN_ACROSS) return [];

      return [
        {
          markId: mark.id,
          text: format(mark.value),
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          inside: true
        }
      ];
    }

    // Clustered and overlaid: directly above the bar, centred on it.
    if ((horizontal ? box.height : box.width) < MIN_ACROSS) return [];

    return [
      {
        markId: mark.id,
        text: format(mark.value),
        x: horizontal ? box.x + box.width + 4 : box.x + box.width / 2,
        y: horizontal ? box.y + box.height / 2 : box.y - 5,
        inside: false
      }
    ];
  });
};

/** One figure per column, over the whole column or cluster. */
export const placeTotalLabels = (
  marks: readonly Mark[],
  bands: readonly { category: string; box: Box }[],
  horizontal: boolean,
  format: (value: number) => string
): PlacedLabel[] =>
  bands.flatMap((band) => {
    const own = marks.filter((mark) => mark.category === band.category);
    if (own.length === 0) return [];

    const total = own.reduce((sum, mark) => sum + mark.value, 0);
    if (total === 0) return [];

    // The top of the tallest thing in the band, whether that is a stack or the
    // tallest bar of a cluster. Centred on the band, not on any one series —
    // anchoring to the last series is what made the total read as its label.
    const edge = horizontal
      ? Math.max(...own.map((mark) => mark.box.x + mark.box.width))
      : Math.min(...own.map((mark) => mark.box.y));

    return [
      {
        markId: `${band.category}::total`,
        text: format(total),
        x: horizontal ? edge + 6 : band.box.x + band.box.width / 2,
        y: horizontal ? band.box.y + band.box.height / 2 : edge - 6,
        inside: false
      }
    ];
  });

/** Slices, as marks, for a pie. */
export const layoutPie = (
  data: readonly Record<string, unknown>[],
  categoryField: string,
  valueField: string,
  size: { width: number; height: number }
): { marks: Mark[]; slices: { markId: string; path: string; mid: number }[]; centre: { x: number; y: number }; radius: number } => {
  const centre = { x: size.width / 2, y: size.height / 2 };
  const radius = Math.max(0, Math.min(size.width, size.height) / 2 - 8);

  const values = data.map((row) => Math.max(0, numberAt(row, valueField)));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;

  let angle = -Math.PI / 2;
  const marks: Mark[] = [];
  const slices: { markId: string; path: string; mid: number }[] = [];

  data.forEach((row, index) => {
    const category = String(row[categoryField] ?? index);
    const share = values[index] / total;
    const sweep = share * Math.PI * 2;
    const from = angle;
    const to = angle + sweep;
    angle = to;

    const point = (a: number, r: number) => ({
      x: centre.x + Math.cos(a) * r,
      y: centre.y + Math.sin(a) * r
    });
    const start = point(from, radius);
    const end = point(to, radius);
    const large = sweep > Math.PI ? 1 : 0;

    const id = markId(category, valueField);
    slices.push({
      markId: id,
      path: `M ${centre.x} ${centre.y} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y} Z`,
      mid: (from + to) / 2
    });

    const mid = point((from + to) / 2, radius / 2);
    marks.push({
      id,
      kind: "slice",
      category,
      seriesKey: valueField,
      value: values[index],
      color: seriesColor(index),
      box: { x: mid.x - 1, y: mid.y - 1, width: 2, height: 2 }
    });
  });

  return { marks, slices, centre, radius };
};
