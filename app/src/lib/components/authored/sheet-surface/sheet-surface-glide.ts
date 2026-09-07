import {
  CompactSelection,
  GridCellKind,
  type GridCell,
  type GridSelection,
  type Rectangle,
  type Theme
} from "@glideapps/glide-data-grid";

import type { Measure } from "$authored-components/sheet-surface/sheet-surface-theme";
import type {
  SurfaceBorder,
  SurfaceBorderLine,
  SurfaceBorderSide,
  SurfaceCell,
  SurfaceDirection,
  SurfaceHighlight,
  SurfaceRect,
  SurfaceRun,
  SurfaceScene,
  SurfaceSelection,
  SurfaceValign
} from "$authored-components/sheet-surface/sheet-surface-types";

export const drawsItself = (cell: SurfaceCell): boolean =>
  !cell.covered && (cell.runs !== undefined || cell.valign !== "middle" || cell.underline || cell.strike);

export const appendCell = (measure: Measure): GridCell => ({
  kind: GridCellKind.Text,
  data: "",
  displayData: "",
  allowOverlay: false,
  readonly: true,
  themeOverride: { bgCell: measure.paint(undefined, "--token-surface-panel") }
});

const DELTA: Record<SurfaceDirection, readonly [column: number, row: number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};

export const jumpTarget = (
  scene: SurfaceScene,
  from: readonly [column: number, row: number],
  direction: SurfaceDirection
): [column: number, row: number] => {
  const [dc, dr] = DELTA[direction];
  const inside = (column: number, row: number) =>
    column >= 0 && column < scene.columns.length && row >= 0 && row < scene.rows.length;
  const filled = (column: number, row: number) => scene.cellAt(row, column).text !== "";
  let [column, row] = from;
  if (!inside(column + dc, row + dr)) return [column, row];

  if (filled(column, row) && filled(column + dc, row + dr)) {
    while (inside(column + dc, row + dr) && filled(column + dc, row + dr)) {
      column += dc;
      row += dr;
    }
    return [column, row];
  }

  column += dc;
  row += dr;
  while (inside(column + dc, row + dr) && !filled(column, row)) {
    column += dc;
    row += dr;
  }
  return [column, row];
};

export const rectangleOf = (rect: SurfaceRect): Rectangle => ({
  x: rect.column,
  y: rect.row,
  width: rect.columns,
  height: rect.rows
});

export const rectOf = (rectangle: Rectangle): SurfaceRect => ({
  row: rectangle.y,
  column: rectangle.x,
  rows: rectangle.height,
  columns: rectangle.width
});

const compact = (indices: readonly number[]): CompactSelection =>
  indices.reduce((held, index) => held.add(index), CompactSelection.empty());

export const gridSelectionOf = (selection: SurfaceSelection | undefined): GridSelection => {
  if (selection === undefined) {
    return { columns: CompactSelection.empty(), rows: CompactSelection.empty() };
  }
  const [primary, ...rest] = selection.ranges;
  const cell = selection.cell ?? (primary ? [primary.column, primary.row] : undefined);
  return {
    current:
      cell === undefined || primary === undefined
        ? undefined
        : { cell, range: rectangleOf(primary), rangeStack: rest.map(rectangleOf) },
    columns: compact(selection.columns),
    rows: compact(selection.rows)
  };
};

export const surfaceSelectionOf = (selection: GridSelection): SurfaceSelection => ({
  cell: selection.current?.cell,
  ranges:
    selection.current === undefined
      ? []
      : [rectOf(selection.current.range), ...selection.current.rangeStack.map(rectOf)],
  rows: selection.rows.toArray(),
  columns: selection.columns.toArray()
});

const TONE_COLOUR: Record<SurfaceCell["tone"], string | undefined> = {
  plain: undefined,
  formula: undefined,
  pending: "--token-ink-muted",
  error: "--token-color-danger-text",
  spill: "--token-color-interactive-text"
};

const fontOf = (cell: SurfaceCell, base: number, scale: number): string => {
  const size = (cell.size === undefined ? base : cell.size * scale).toFixed(2);
  const style = cell.italic || cell.tone === "pending" ? "italic " : "";
  const weight = cell.weight === 400 ? "" : `${cell.weight} `;
  return `${style}${weight}${size}px`;
};

export const gridCellOf = (
  cell: SurfaceCell,
  column: number,
  measure: Measure,
  mono: string,
  base: number,
  scale: number
): GridCell => {
  if (cell.covered) {
    return {
      kind: GridCellKind.Text,
      data: "",
      displayData: "",
      allowOverlay: false,
      readonly: true,
      span:
        cell.span === undefined || cell.spanFrom === undefined
          ? undefined
          : [cell.spanFrom, cell.spanFrom + cell.span - 1],
      themeOverride: { borderColor: measure.paint(undefined, "--token-surface-elevated") }
    };
  }

  const override: Partial<Theme> = { baseFontStyle: fontOf(cell, base, scale) };
  const colour = cell.color ?? TONE_COLOUR[cell.tone];
  if (colour !== undefined) override.textDark = measure.paint(colour, "--token-ink-primary");
  if (cell.background !== undefined) {
    override.bgCell = measure.paint(cell.background, "--token-surface-elevated");
  } else if (cell.spilled) {
    override.bgCell = measure.paint(undefined, "--token-color-interactive-surface");
  }
  if (cell.color !== undefined) override.textDark = measure.paint(cell.color, "--token-ink-primary");
  if (cell.mono || cell.tone === "error") override.fontFamily = mono;
  if (cell.font !== undefined) override.fontFamily = cell.font;
  if (cell.size !== undefined) override.editorFontSize = `${cell.size * scale}px`;

  return {
    kind: GridCellKind.Text,
    data: cell.raw,
    displayData: drawsItself(cell) ? "" : cell.text,
    copyData: cell.raw,
    allowOverlay: !cell.readonly,
    readonly: cell.readonly,
    contentAlign: cell.align,
    span: cell.span === undefined ? undefined : [column, column + cell.span - 1],
    themeOverride: override
  };
};

const HIGHLIGHT: Record<
  SurfaceHighlight["tone"],
  { readonly token: string; readonly style: "solid-outline" | "no-outline" }
> = {
  reads: { token: "--token-color-interactive-border", style: "solid-outline" },
  feeds: { token: "--token-color-attention-border", style: "solid-outline" },
  hit: { token: "--token-color-attention-surface", style: "no-outline" },
  current: { token: "--token-color-attention-surface", style: "no-outline" },
  spill: { token: "--token-color-interactive-border", style: "solid-outline" },
  selected: { token: "--token-surface-selection", style: "no-outline" }
};

export const regionsOf = (highlights: readonly SurfaceHighlight[], measure: Measure) =>
  highlights.map((highlight) => {
    const { token, style } = HIGHLIGHT[highlight.tone];
    return { color: measure.paint(undefined, token), range: rectangleOf(highlight.rect), style };
  });

type FontParts = { readonly italic: boolean; readonly weight: string; readonly size: number };

const partsOf = (base: string): FontParts => {
  const match = /^(italic\s+)?(\d{3}\s+)?(\d+(?:\.\d+)?)px$/.exec(base.trim());
  return {
    italic: match?.[1] !== undefined,
    weight: match?.[2]?.trim() ?? "",
    size: match === null ? 13 : Number(match[3])
  };
};

const runFont = (run: SurfaceRun, parts: FontParts, mono: string, family: string): string => {
  const style = run.italic || parts.italic ? "italic " : "";
  const weight = run.bold ? "600 " : parts.weight === "" ? "" : `${parts.weight} `;
  return `${style}${weight}${parts.size}px ${run.code ? mono : family}`;
};

export const runOf = (cell: SurfaceCell): SurfaceRun => ({
  text: cell.text,
  bold: false,
  italic: false,
  underline: cell.underline,
  strike: cell.strike,
  code: false
});

export const drawRuns = (
  ctx: CanvasRenderingContext2D,
  runs: readonly SurfaceRun[],
  rect: Rectangle,
  align: SurfaceCell["align"],
  valign: SurfaceValign,
  theme: Theme,
  measure: Measure,
  mono: string,
  padding: number
): void => {
  const family = theme.fontFamily;
  const parts = partsOf(theme.baseFontStyle);
  const widths = runs.map((run) => {
    ctx.font = runFont(run, parts, mono, family);
    return ctx.measureText(run.text).width;
  });
  const total = widths.reduce((sum, width) => sum + width, 0);
  const room = rect.width - padding * 2;
  let x =
    align === "right"
      ? rect.x + rect.width - padding - total
      : align === "center"
        ? rect.x + (rect.width - total) / 2
        : rect.x + padding;
  if (total > room && align !== "left") x = rect.x + padding;
  const inset = Math.max(padding, 3);
  const y =
    valign === "top"
      ? rect.y + inset + parts.size / 2
      : valign === "bottom"
        ? rect.y + rect.height - inset - parts.size / 2
        : rect.y + rect.height / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  ctx.clip();
  ctx.textBaseline = "middle";
  runs.forEach((run, index) => {
    ctx.font = runFont(run, parts, mono, family);
    ctx.fillStyle = run.color === undefined ? theme.textDark : measure.paint(run.color, "--token-ink-primary");
    ctx.fillText(run.text, x, y);
    if (run.underline) ctx.fillRect(x, y + parts.size * 0.42, widths[index], 1);
    if (run.strike) ctx.fillRect(x, y - 1, widths[index], 1);
    x += widths[index];
  });
  ctx.restore();
};

const DASH: Record<SurfaceBorderLine["style"], readonly number[]> = {
  solid: [],
  dashed: [4, 3],
  dotted: [1, 3]
};

const EDGES: readonly SurfaceBorderSide[] = ["top", "right", "bottom", "left"];

/** The grid draws its own hairline over every cell after this, so a border sits inside it. */
const RULE = 1;

const edgeOf = (rect: Rectangle, side: SurfaceBorderSide, inset: number): readonly [number, number, number, number] => {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  switch (side) {
    case "top":
      return [rect.x, rect.y + inset, right, rect.y + inset];
    case "bottom":
      return [rect.x, bottom - inset, right, bottom - inset];
    case "left":
      return [rect.x + inset, rect.y, rect.x + inset, bottom];
    default:
      return [right - inset, rect.y, right - inset, bottom];
  }
};

/** A cell's own border, drawn inside its rectangle so a neighbour cannot cover it. */
export const drawBorder = (
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  border: SurfaceBorder,
  measure: Measure,
  scale: number
): void => {
  ctx.save();
  for (const side of EDGES) {
    const line = border[side];
    if (line === undefined) continue;
    const width = Math.max(1, Math.round(line.width * scale));
    const [fromX, fromY, toX, toY] = edgeOf(rect, side, width / 2 + RULE);
    ctx.strokeStyle = measure.paint(line.color, "--token-border-strong");
    ctx.lineWidth = width;
    ctx.setLineDash(DASH[line.style].map((part) => part * scale));
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawPin = (
  ctx: CanvasRenderingContext2D,
  rect: Rectangle,
  state: "open" | "current" | "detached",
  measure: Measure,
  scale: number
): void => {
  const size = Math.round(7 * scale);
  const token =
    state === "current"
      ? "--token-color-active-fill"
      : state === "detached"
        ? "--token-color-inactive-fill"
        : "--token-color-attention-fill";
  ctx.save();
  ctx.fillStyle = measure.paint(undefined, token);
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.width - size - 1, rect.y + 1);
  ctx.lineTo(rect.x + rect.width - 1, rect.y + 1);
  ctx.lineTo(rect.x + rect.width - 1, rect.y + size + 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
