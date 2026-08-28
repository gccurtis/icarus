/**
 * What a chart *is*, separately from how it is drawn.
 *
 * Every chart on every screen is one of these objects. The renderer is a
 * function of it, which is what makes a chart something you can save, template,
 * diff, and hand to another surface — an Analysis screen and a 300px inspector
 * preview render the same spec at different sizes, and neither owns it.
 *
 * **The type is part of the spec, not a choice of component.** Which settings
 * are even meaningful depends on it — clustering means nothing to a pie, an
 * orientation means nothing to a scatter — so the type has to sit beside the
 * settings it governs rather than upstream of them. `settingsFor` below is the
 * function that answers "what can be asked of this chart", and it is what a
 * settings panel should be driven by instead of a hand-written branch per type.
 */
export type ChartType = "bar" | "line" | "area" | "scatter" | "pie" | "mekko";

/** How several series share the space. Bars and areas only. */
export type SeriesLayout = "stack" | "group" | "expand" | "overlap";

/** Which axis the categories run along. */
export type Orientation = "vertical" | "horizontal";

/** Figures drawn on the marks themselves. */
export type LabelMode = "none" | "value" | "total";

/**
 * One axis: what it reads, what it is called, and how it is written.
 *
 * **`domain` is an override, not the source of truth.** A chart derives its
 * range from its data, because a domain fixed in the spec silently clips the
 * moment the data outgrows it. Setting it is a deliberate act — pinning two
 * charts to the same scale so they can be compared — and the renderer must say
 * when data falls outside it rather than cropping quietly.
 */
export type AxisSpec = {
  /** The field this axis reads. The value axis derives its own. */
  field?: string;
  /** What the axis is called. Absent when the field speaks for itself. */
  title?: string;
  /** Replace the derived ticks entirely. */
  ticks?: readonly (string | number)[];
  /** How a tick is written. */
  format?: (value: number | string) => string;
  /** Whether gridlines run from this axis. */
  grid?: boolean;
  /** Pin the range instead of deriving it. */
  domain?: readonly [number, number];
};

/** One line, band, or set of slices. */
export type SeriesSpec = {
  key: string;
  label?: string;
  /** Absent falls back to the role tokens, in order. */
  color?: string;
  /** Hidden series keep their colour slot, so hiding one does not recolour the rest. */
  hidden?: boolean;
};

/** Everything about the whole chart rather than one series. */
export type ChartSettings = {
  layout?: SeriesLayout;
  orientation?: Orientation;
  labels?: LabelMode;
  legend?: boolean;
  height?: number;
  /** How a figure is written wherever one appears. */
  format?: (value: number) => string;
};

export type ChartSpec = {
  type: ChartType;
  data: readonly Record<string, unknown>[];
  /** The category axis. */
  x: AxisSpec;
  /** The value axis. */
  y: AxisSpec;
  series: readonly SeriesSpec[];
  settings: ChartSettings;
};

/**
 * Which settings mean anything for a given type.
 *
 * A settings panel reads this rather than branching on the type itself, so a
 * control that cannot work on this chart is *absent* rather than drawn and
 * ignored — the same rule the panel vocabulary keeps about disabled controls.
 * The current demo draws Clustered/Stacked/100% beside a pie, which is exactly
 * the failure this exists to stop.
 */
export const settingsFor = (
  type: ChartType
): { layout: boolean; orientation: boolean; labels: boolean; grid: boolean } => {
  switch (type) {
    case "bar":
      return { layout: true, orientation: true, labels: true, grid: true };
    case "area":
      // No orientation: a horizontal area chart is a shape nobody reads.
      return { layout: true, orientation: false, labels: false, grid: true };
    case "line":
    case "scatter":
      return { layout: false, orientation: false, labels: true, grid: true };
    case "mekko":
      // Width is already a quantity, so the layout is decided; it is always stacked.
      return { layout: false, orientation: false, labels: true, grid: false };
    case "pie":
      return { layout: false, orientation: false, labels: true, grid: false };
  }
};

/**
 * One drawable, addressable thing: a bar, a stack segment, a slice, a point.
 *
 * **This is the part that makes the chart controllable rather than a picture.**
 * A renderer that draws straight from the data can only be styled as a whole; a
 * renderer that first produces marks can be asked about any one of them — which
 * is what selecting a single bar in a cluster, colouring one slice differently,
 * or annotating one segment all require. Everything a person can point at is a
 * mark with an id.
 *
 * **The id is derived from what the mark *is*, never from its position.** A
 * chart that is sorted, filtered, or has a series hidden re-lays-out completely,
 * and a selection keyed on position would silently move to a different bar. The
 * category and the series key together are the identity.
 */
export type MarkKind = "bar" | "segment" | "slice" | "point";

export type Mark = {
  /** `<category>::<seriesKey>` — stable across sorting, filtering and hiding. */
  id: string;
  kind: MarkKind;
  /** Which column, slice or group it belongs to. */
  category: string;
  seriesKey: string;
  value: number;
  /** The colour it is painted, already resolved through the palette. */
  color: string;
  /**
   * Where it sits, in the plot's own coordinate space.
   *
   * A box even for a slice, which is its bounding box: a label placer, a
   * selection outline and a hit test all want a rectangle, and the one shape
   * that genuinely needs its own geometry is the slice's arc, which the renderer
   * keeps to itself.
   */
  box: { x: number; y: number; width: number; height: number };
};

/** The id a mark will have, so a caller can select one before it is drawn. */
export const markId = (category: string, seriesKey: string) => `${category}::${seriesKey}`;

/** The category and series a mark id refers to. */
export const readMarkId = (id: string) => {
  const [category = "", seriesKey = ""] = id.split("::");
  return { category, seriesKey };
};
