import type { ChartFrame, SpreadsheetChart } from "$json-store/types/data/chart";

export type ChartBounds = { width: number; height: number };
export type ChartMinimum = { width: number; height: number };

export const DEFAULT_CHART_MINIMUM: ChartMinimum = { width: 240, height: 180 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Move without changing size; optional bounds keep the complete frame reachable. */
export const moveChartFrame = (
  frame: ChartFrame,
  dx: number,
  dy: number,
  bounds?: ChartBounds
): ChartFrame => ({
  ...frame,
  x: bounds === undefined ? frame.x + dx : clamp(frame.x + dx, 0, bounds.width - frame.width),
  y: bounds === undefined ? frame.y + dy : clamp(frame.y + dy, 0, bounds.height - frame.height)
});

/** Resize from the south-east corner and preserve the frame's origin. */
export const resizeChartFrame = (
  frame: ChartFrame,
  dw: number,
  dh: number,
  bounds?: ChartBounds,
  minimum: ChartMinimum = DEFAULT_CHART_MINIMUM
): ChartFrame => ({
  ...frame,
  width: clamp(
    frame.width + dw,
    minimum.width,
    bounds === undefined ? Number.POSITIVE_INFINITY : bounds.width - frame.x
  ),
  height: clamp(
    frame.height + dh,
    minimum.height,
    bounds === undefined ? Number.POSITIVE_INFINITY : bounds.height - frame.y
  )
});

/** Placement adapter for a chart stored in a spreadsheet body. */
export const frameForSpreadsheetChart = (
  chart: SpreadsheetChart,
  anchorPosition: { x: number; y: number }
): ChartFrame => ({
  x: anchorPosition.x + chart.offset.x,
  y: anchorPosition.y + chart.offset.y,
  width: chart.size.width,
  height: chart.size.height
});
