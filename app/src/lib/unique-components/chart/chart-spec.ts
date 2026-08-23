/**
 * Ephemeral geometry produced from a persisted chart model.
 *
 * Model ids flow through unchanged. Geometry may be recomputed at every size,
 * but every bar, slice, point, cell, stage, segment, or tile keeps the datum id
 * that selection, comments and revisions address.
 */
export type ChartBox = { x: number; y: number; width: number; height: number };

export type ChartMarkKind =
  | "bar"
  | "segment"
  | "slice"
  | "point"
  | "bubble"
  | "step"
  | "cell"
  | "tile";

export type ChartMark = {
  /** The persisted `ChartDatum.id`. */
  id: string;
  kind: ChartMarkKind;
  datumId: string;
  categoryId: string;
  categoryLabel: string;
  seriesId: string;
  seriesLabel: string;
  value: number;
  label?: string;
  color: string;
  opacity: number;
  box: ChartBox;
};

export type ChartBand = {
  categoryId: string;
  label: string;
  box: ChartBox;
};
